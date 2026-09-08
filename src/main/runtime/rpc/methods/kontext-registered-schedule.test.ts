import { beforeEach, expect, it, vi } from 'vitest'
import { registeredScheduleFixture as inspection } from '../../../../shared/__fixtures__/kontext-registered-schedule'
import type { OrcaRuntimeService } from '../../orca-runtime'
import { RpcDispatcher } from '../dispatcher'
import { kontextRegisteredScheduleMethods } from './kontext-registered-schedule'
const mocks = vi.hoisted(() => ({ callTool: vi.fn(), getService: vi.fn() }))
vi.mock('../../../kontext/kontext-sidecar-runtime', () => ({
  getKontextSidecarService: mocks.getService
}))
const selector = { taskId: inspection.job.taskId, jobId: inspection.job.jobId }
const control = { ...selector, expectedJobIdentityDigest: inspection.jobIdentityDigest }
function call(method: string, params: unknown, signal?: AbortSignal, legacy = false) {
  return new RpcDispatcher({
    runtime: { getRuntimeId: () => 'owning-host' } as unknown as OrcaRuntimeService,
    methods: legacy ? [] : kontextRegisteredScheduleMethods
  }).dispatch({ id: 'test', authToken: 'fixture', method, params }, { signal })
}
beforeEach(() => {
  mocks.getService.mockReset().mockReturnValue({ callTool: mocks.callTool })
  mocks.callTool.mockReset().mockResolvedValue(inspection)
})
it('reads only the owning host with no automatic resume and strips private response fields', async () => {
  mocks.callTool.mockResolvedValue({
    ...inspection,
    prompt: 'PRIVATE',
    job: { ...inspection.job, request: 'PRIVATE', diagnostic: 'PRIVATE' },
    workItems: inspection.workItems.map((work) => ({ ...work, prompt: 'PRIVATE' }))
  })
  const result = await call('kontext.inspectRegisteredSchedule', {
    ...selector,
    hostToken: 'forged',
    directory: '/client'
  })
  expect(result).toMatchObject({ ok: true, result: inspection })
  expect(JSON.stringify(result)).not.toContain('PRIVATE')
  expect(mocks.callTool).toHaveBeenCalledExactlyOnceWith(
    'kontext_inspect_registered_schedule',
    selector
  )
  expect(mocks.getService).toHaveBeenCalledExactlyOnceWith('owning-host')
})
it.each([
  [
    'resume',
    'kontext.resumeRegisteredSchedule',
    'kontext_resume_registered_schedule',
    { ...control, allowSubscriptionExecution: true }
  ],
  ['cancel', 'kontext.cancelRegisteredSchedule', 'kontext_cancel_registered_schedule', control]
] as const)(
  'routes one explicit %s without resolving a local workspace or reconstructing enqueue input',
  async (action, method, tool, request) => {
    mocks.callTool.mockResolvedValue({
      ...inspection,
      command: { action, ...(action === 'resume' ? { resumeBlocked: true } : {}) }
    })
    expect(await call(method, request)).toMatchObject({ ok: true, result: { command: { action } } })
    expect(mocks.callTool).toHaveBeenCalledExactlyOnceWith(tool, request)
    mocks.callTool.mockRejectedValueOnce(new Error('lost response'))
    expect(await call(method, request)).toMatchObject({ ok: false })
    expect(mocks.callTool).toHaveBeenCalledTimes(2)
  }
)
it('requires explicit subscription consent and the reviewed identity for controls', async () => {
  expect(await call('kontext.resumeRegisteredSchedule', control)).toMatchObject({
    ok: false,
    error: { code: 'invalid_argument' }
  })
  expect(await call('kontext.cancelRegisteredSchedule', selector)).toMatchObject({
    ok: false,
    error: { code: 'invalid_argument' }
  })
  expect(mocks.callTool).not.toHaveBeenCalled()
})
it.each([
  { ...inspection, currentEvidence: 'revalidated_current' },
  { ...inspection, job: { ...inspection.job, taskId: 'wrong' } },
  { ...inspection, job: { ...inspection.job, jobId: 'wrong' } },
  { ...inspection, job: { ...inspection.job, status: 'unknown' } },
  { ...inspection, workItems: [...inspection.workItems, ...inspection.workItems] },
  {
    ...inspection,
    workItems: inspection.workItems.map((work) => ({
      ...work,
      result: { workItemId: 'wrong', status: 'completed', attempts: 1 }
    }))
  },
  { ...inspection, command: { action: 'cancel' } }
])('refuses contradictory or unrelated inspection without fallback', async (response) => {
  mocks.callTool.mockResolvedValue(response)
  expect(await call('kontext.inspectRegisteredSchedule', selector)).toMatchObject({ ok: false })
  expect(mocks.callTool).toHaveBeenCalledTimes(1)
})
it('refuses changed identity, wrong command and missing command acknowledgement', async () => {
  expect(await call('kontext.cancelRegisteredSchedule', control)).toMatchObject({ ok: false })
  mocks.callTool.mockResolvedValue({
    ...inspection,
    command: { action: 'cancel' },
    jobIdentityDigest: `sha256:${'c'.repeat(64)}`
  })
  expect(await call('kontext.cancelRegisteredSchedule', control)).toMatchObject({ ok: false })
  mocks.callTool.mockResolvedValue({
    ...inspection,
    command: { action: 'resume', resumeBlocked: false }
  })
  expect(await call('kontext.cancelRegisteredSchedule', control)).toMatchObject({ ok: false })
})
it('refuses an older host and cancelled reads without a local substitute', async () => {
  expect(await call('kontext.inspectRegisteredSchedule', selector, undefined, true)).toMatchObject({
    ok: false,
    error: { code: 'method_not_found' }
  })
  const before = new AbortController()
  before.abort()
  expect(await call('kontext.inspectRegisteredSchedule', selector, before.signal)).toMatchObject({
    ok: false
  })
  expect(mocks.callTool).not.toHaveBeenCalled()
  const during = new AbortController()
  mocks.callTool.mockImplementation(async () => {
    during.abort()
    return inspection
  })
  expect(await call('kontext.inspectRegisteredSchedule', selector, during.signal)).toMatchObject({
    ok: false
  })
})
