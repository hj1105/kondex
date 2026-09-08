import { describe, expect, it, vi } from 'vitest'
import type { OrcaRuntimeService } from '../../orca-runtime'
import { RpcDispatcher } from '../dispatcher'
import { ALL_RPC_METHODS } from './index'
import { createKontextScheduleMethods } from './kontext-schedule'

const job = {
  jobId: 'schedule-1',
  taskId: 'task-1',
  repositoryPath: '/host/repo ',
  codeRevision: 'revision-1',
  contextDigest: 'digest-1',
  status: 'queued',
  requestedAt: '2026-09-06T00:00:00.000Z',
  resumeCount: 0
}
const start = {
  worktree: 'host-qualified-worktree',
  taskId: 'task-1',
  work: [
    { workItemId: 'logic-1', prompt: 'Implement the approved logic.', eligibleProviders: ['codex'] }
  ],
  maxConcurrency: 2,
  maxRetries: 1
}
const integration = {
  state: {
    taskId: job.taskId,
    scheduleJobId: job.jobId,
    repositoryPath: job.repositoryPath,
    workspacePath: '/host/integration',
    baseRevision: job.codeRevision,
    gitCommit: 'integration-commit',
    resultRevision: 'integrated-revision',
    contextDigest: job.contextDigest,
    changeBundleIds: ['bundle-1'],
    workItemIds: ['logic-1'],
    changedPaths: ['src/logic.ts'],
    changedSymbolIds: ['symbol-1'],
    authorProviders: ['codex'],
    createdAt: job.requestedAt
  },
  executions: [{ run: { outcome: 'fail' }, diagnostic: 'Full verification failed' }],
  review: { verificationRun: { outcome: 'inconclusive' }, findings: [] }
}

function harness() {
  const callTool = vi.fn().mockResolvedValue(job)
  const sidecar = vi.fn(() => ({ callTool }))
  const resolveKontextScheduleRepository = vi.fn().mockResolvedValue(job.repositoryPath)
  const runtime = {
    getRuntimeId: () => 'owning-host',
    resolveKontextScheduleRepository
  } as unknown as OrcaRuntimeService
  const dispatcher = new RpcDispatcher({ runtime, methods: createKontextScheduleMethods(sidecar) })
  const call = (method: string, params: unknown, signal?: AbortSignal) =>
    dispatcher.dispatch(
      { id: 'request-1', authToken: 'fixture', method: `kontext.${method}`, params },
      { signal }
    )
  return { call, callTool, sidecar, runtime, resolveKontextScheduleRepository }
}

describe('Kontext schedule RPC', () => {
  it('registers explicit controls but no misleading read-only get method', () => {
    const names = ALL_RPC_METHODS.map((method) => method.name)
    for (const name of [
      'scheduleLogic',
      'refreshSchedule',
      'cancelSchedule',
      'integrateSchedule'
    ]) {
      expect(names).toContain(`kontext.${name}`)
    }
    expect(names).not.toContain('kontext.getSchedule')
  })

  it('starts once using the host-resolved repository and strips new optional client fields', async () => {
    const h = harness()
    expect(
      await h.call('scheduleLogic', {
        ...start,
        repositoryPath: '/wrong/client/path',
        future: true
      })
    ).toMatchObject({ ok: true, result: job })
    expect(h.resolveKontextScheduleRepository).toHaveBeenCalledExactlyOnceWith(start.worktree)
    expect(h.callTool).toHaveBeenCalledExactlyOnceWith('kontext_schedule_logic', {
      taskId: start.taskId,
      repositoryPath: job.repositoryPath,
      work: start.work,
      maxConcurrency: 2,
      maxRetries: 1
    })
  })

  it.each([
    { maxConcurrency: 5 },
    { maxRetries: 3 },
    { work: [] },
    { taskId: ' ' },
    { work: [{ ...start.work[0], eligibleProviders: ['api'] }] },
    { work: [{ ...start.work[0], receiptTtlSeconds: 1 }] }
  ])('rejects invalid scheduling input before contacting the host: %j', async (invalid) => {
    const h = harness()
    expect(await h.call('scheduleLogic', { ...start, ...invalid })).toMatchObject({
      ok: false,
      error: { code: 'invalid_argument' }
    })
    expect(h.sidecar).not.toHaveBeenCalled()
    expect(h.resolveKontextScheduleRepository).not.toHaveBeenCalled()
  })

  it('does not contact the sidecar if host resolution fails', async () => {
    const h = harness()
    h.resolveKontextScheduleRepository.mockRejectedValue(new Error('Remote target unavailable'))
    expect(await h.call('scheduleLogic', start)).toMatchObject({ ok: false })
    expect(h.sidecar).not.toHaveBeenCalled()
  })

  it('forwards the same durable enqueue request identity and requires its confirmation', async () => {
    const h = harness()
    const requestId = 'b8a2a3f8-7fb9-44da-a868-1d4019164729'
    h.callTool.mockResolvedValue({ ...job, requestId })
    expect(await h.call('enqueueSchedule', { ...start, requestId })).toMatchObject({
      ok: true,
      result: { requestId }
    })
    expect(h.callTool).toHaveBeenCalledExactlyOnceWith(
      'kontext_schedule_logic',
      expect.objectContaining({ requestId })
    )
  })

  it('requires a durable request identity on the replay-safe enqueue interface', async () => {
    const h = harness()
    expect(await h.call('enqueueSchedule', start)).toMatchObject({
      ok: false,
      error: { code: 'invalid_argument' }
    })
    expect(h.callTool).not.toHaveBeenCalled()
  })

  it('cannot downgrade replay-safe enqueue to an older host that only supports unkeyed scheduling', async () => {
    const h = harness()
    const old = new RpcDispatcher({
      runtime: h.runtime,
      methods: createKontextScheduleMethods(() => ({ callTool: h.callTool })).filter(
        (method) => method.name !== 'kontext.enqueueSchedule'
      )
    })
    expect(
      await old.dispatch({
        id: 'old-enqueue',
        authToken: 'fixture',
        method: 'kontext.enqueueSchedule',
        params: { ...start, requestId: 'b8a2a3f8-7fb9-44da-a868-1d4019164729' }
      })
    ).toMatchObject({ ok: false, error: { code: 'method_not_found' } })
    expect(h.callTool).not.toHaveBeenCalled()
  })

  it.each([undefined, '9d594de0-af89-40ef-861a-0b87977e80e6'])(
    'does not silently downgrade keyed enqueue when sidecar identity is %s',
    async (requestId) => {
      const h = harness()
      h.callTool.mockResolvedValue({ ...job, requestId })
      expect(
        await h.call('scheduleLogic', {
          ...start,
          requestId: 'b8a2a3f8-7fb9-44da-a868-1d4019164729'
        })
      ).toMatchObject({
        ok: false,
        error: { message: expect.stringContaining('did not confirm the schedule request identity') }
      })
      expect(h.callTool).toHaveBeenCalledTimes(1)
    }
  )

  it.each([undefined, false])(
    'requires explicit automatic-resume authority (%s)',
    async (allowAutomaticResume) => {
      const h = harness()
      expect(
        await h.call('refreshSchedule', { jobId: job.jobId, allowAutomaticResume })
      ).toMatchObject({ ok: false, error: { code: 'invalid_argument' } })
      expect(h.callTool).not.toHaveBeenCalled()
    }
  )

  it('refreshes with resume authority without forwarding the UI-only field to strict MCP params', async () => {
    const h = harness()
    h.callTool.mockResolvedValue({
      ...job,
      status: 'interrupted',
      resumeBlocked: true,
      resumeDiagnostic: 'Evidence is stale',
      futureField: true
    })
    expect(
      await h.call('refreshSchedule', { jobId: job.jobId, allowAutomaticResume: true })
    ).toMatchObject({
      ok: true,
      result: { status: 'interrupted', resumeBlocked: true, resumeDiagnostic: 'Evidence is stale' }
    })
    expect(h.callTool).toHaveBeenCalledExactlyOnceWith('kontext_get_schedule', { jobId: job.jobId })
  })

  it('does not turn cancellation acceptance into proof of stopped workers', async () => {
    const h = harness()
    h.callTool.mockResolvedValue({ ...job, status: 'cancelling' })
    expect(await h.call('cancelSchedule', { jobId: job.jobId })).toMatchObject({
      ok: true,
      result: { status: 'cancelling' }
    })
    expect(h.callTool).toHaveBeenCalledExactlyOnceWith('kontext_cancel_schedule', {
      jobId: job.jobId
    })
  })

  it('retains failed work inside a completed schedule without inventing Task success', async () => {
    const h = harness()
    const results = [
      { workItemId: 'logic-1', status: 'failed', attempts: 1, diagnostics: ['No accepted bundle'] }
    ]
    h.callTool.mockResolvedValue({
      ...job,
      status: 'completed',
      result: { results, capabilities: [] }
    })
    const response = await h.call('refreshSchedule', {
      jobId: job.jobId,
      allowAutomaticResume: true
    })
    expect(response).toMatchObject({
      ok: true,
      result: { status: 'completed', result: { results } }
    })
    if (response.ok) {
      expect(response.result).not.toHaveProperty('done')
    }
  })

  it.each([{ ...job, jobId: 'other' }, { ...job, status: 'invented' }, {}])(
    'refuses a wrong or malformed schedule response',
    async (response) => {
      const h = harness()
      h.callTool.mockResolvedValue(response)
      expect(await h.call('cancelSchedule', { jobId: job.jobId })).toMatchObject({
        ok: false,
        error: { message: expect.stringContaining('outcome is unknown') }
      })
      expect(h.callTool).toHaveBeenCalledTimes(1)
    }
  )

  it('does not retry an ambiguous enqueue transport failure', async () => {
    const h = harness()
    h.callTool.mockRejectedValue(new Error('Connection lost after enqueue'))
    expect(await h.call('scheduleLogic', start)).toMatchObject({
      ok: false,
      error: { message: expect.stringContaining('Do not retry automatically') }
    })
    expect(h.callTool).toHaveBeenCalledTimes(1)
  })

  it.each([{ taskId: 'another-task' }, { repositoryPath: '/another/repo' }])(
    'rejects enqueue responses from a different scope: %j',
    async (changed) => {
      const h = harness()
      h.callTool.mockResolvedValue({ ...job, ...changed })
      expect(await h.call('scheduleLogic', start)).toMatchObject({
        ok: false,
        error: { message: expect.stringContaining('different task or repository') }
      })
      expect(h.callTool).toHaveBeenCalledTimes(1)
    }
  )

  it('returns integration evidence unchanged without interpreting patch application as verified completion', async () => {
    const h = harness()
    h.callTool.mockResolvedValue(integration)
    const request = {
      jobId: job.jobId,
      observedAt: job.requestedAt,
      nextAttemptAt: '2026-09-06T01:00:00.000Z'
    }
    expect(await h.call('integrateSchedule', request)).toMatchObject({
      ok: true,
      result: integration
    })
    expect(h.callTool).toHaveBeenCalledExactlyOnceWith('kontext_integrate_schedule', request)
  })

  it('accepts the sidecar reused-integration evidence variant', async () => {
    const h = harness()
    const reused = {
      state: integration.state,
      executions: [],
      reviewFindings: [{ severity: 'blocking' }],
      reused: true
    }
    h.callTool.mockResolvedValue(reused)
    expect(
      await h.call('integrateSchedule', {
        jobId: job.jobId,
        observedAt: job.requestedAt,
        nextAttemptAt: job.requestedAt
      })
    ).toMatchObject({ ok: true, result: reused })
  })

  it('refuses integration results for another schedule', async () => {
    const h = harness()
    h.callTool.mockResolvedValue({
      ...integration,
      state: { ...integration.state, scheduleJobId: 'other' }
    })
    expect(
      await h.call('integrateSchedule', {
        jobId: job.jobId,
        observedAt: job.requestedAt,
        nextAttemptAt: job.requestedAt
      })
    ).toMatchObject({
      ok: false,
      error: { message: expect.stringContaining('different schedule') }
    })
  })

  it('does not enqueue after disconnect during repository resolution', async () => {
    const h = harness()
    const controller = new AbortController()
    h.resolveKontextScheduleRepository.mockImplementation(async () => {
      controller.abort()
      return job.repositoryPath
    })
    expect(await h.call('scheduleLogic', start, controller.signal)).toMatchObject({ ok: false })
    expect(h.sidecar).not.toHaveBeenCalled()
  })

  it('does not cancel accepted work merely because its client disconnected', async () => {
    const h = harness()
    const controller = new AbortController()
    h.callTool.mockImplementation(async () => {
      controller.abort()
      return job
    })
    expect(await h.call('scheduleLogic', start, controller.signal)).toMatchObject({
      ok: true,
      result: job
    })
    expect(h.callTool).toHaveBeenCalledTimes(1)
  })

  it('older hosts answer unsupported controls without a fallback mutation', async () => {
    const h = harness()
    const old = new RpcDispatcher({ runtime: h.runtime, methods: [] })
    expect(
      await old.dispatch({
        id: 'old',
        authToken: 'fixture',
        method: 'kontext.scheduleLogic',
        params: start
      })
    ).toMatchObject({ ok: false, error: { code: 'method_not_found' } })
    expect(h.callTool).not.toHaveBeenCalled()
  })
})
