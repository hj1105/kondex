import { beforeEach, expect, it, vi } from 'vitest'
import { finalizationFixture } from '../../../../shared/__fixtures__/kontext-finalization'
import type { OrcaRuntimeService } from '../../orca-runtime'
import { RpcDispatcher } from '../dispatcher'
import { kontextFinalizationMethods } from './kontext-finalization'
const mocks = vi.hoisted(() => ({ callTool: vi.fn() }))
vi.mock('../../../kontext/kontext-sidecar-runtime', () => ({
  getKontextSidecarService: () => ({ callTool: mocks.callTool })
}))
function call(method: string, params: unknown, legacy = false, signal?: AbortSignal) {
  return new RpcDispatcher({
    runtime: { getRuntimeId: () => 'host' } as unknown as OrcaRuntimeService,
    methods: legacy ? [] : kontextFinalizationMethods
  }).dispatch({ id: 'test', authToken: 'fixture', method: `kontext.${method}`, params }, { signal })
}
beforeEach(() => {
  mocks.callTool.mockReset()
})
it('sends the exact reviewed request without caller-supplied authority or evidence', async () => {
  mocks.callTool.mockResolvedValue({
    created: true,
    record: finalizationFixture,
    currentEvidence: 'validated_at_recording',
    token: 'secret'
  })
  const result = await call('finalizeTask', {
    ...finalizationFixture.request,
    subjectId: 'forged',
    approval: ['code_owner'],
    hostToken: 'forged'
  })
  expect(result).toMatchObject({ ok: true, result: { record: finalizationFixture } })
  expect(JSON.stringify(result)).not.toMatch(/forged|secret/)
  expect(mocks.callTool).toHaveBeenCalledExactlyOnceWith(
    'kontext_finalize_task',
    finalizationFixture.request
  )
})
it('refuses another request or a misleading replay and does not retry', async () => {
  for (const result of [
    { created: false, record: finalizationFixture, currentEvidence: 'validated_at_recording' },
    {
      created: true,
      record: {
        ...finalizationFixture,
        request: { ...finalizationFixture.request, jobId: 'other' }
      },
      currentEvidence: 'validated_at_recording'
    }
  ]) {
    mocks.callTool.mockResolvedValue(result)
    expect(await call('finalizeTask', finalizationFixture.request)).toMatchObject({ ok: false })
  }
  expect(mocks.callTool).toHaveBeenCalledTimes(2)
})
it('inspects historical evidence without finalizing and refuses older hosts without fallback', async () => {
  mocks.callTool.mockResolvedValue({
    taskId: finalizationFixture.request.taskId,
    record: finalizationFixture,
    currentEvidence: 'not_revalidated'
  })
  expect(
    await call('inspectFinalization', { taskId: finalizationFixture.request.taskId })
  ).toMatchObject({ ok: true })
  expect(mocks.callTool).toHaveBeenCalledExactlyOnceWith('kontext_inspect_finalization', {
    taskId: finalizationFixture.request.taskId
  })
  expect(await call('finalizeTask', finalizationFixture.request, true)).toMatchObject({
    ok: false,
    error: { code: 'method_not_found' }
  })
  mocks.callTool.mockRejectedValue(new Error('host unavailable'))
  expect(await call('finalizeTask', finalizationFixture.request)).toMatchObject({ ok: false })
  expect(mocks.callTool).toHaveBeenCalledTimes(2)
})

const revalidationRequest = {
  taskId: finalizationFixture.request.taskId,
  expectedRecordId: finalizationFixture.recordId
}
const revalidation = {
  taskId: revalidationRequest.taskId,
  recordId: revalidationRequest.expectedRecordId,
  currentEvidence: 'revalidated_current',
  recordedCompletionBasisDigest: finalizationFixture.request.expectedCompletionBasisDigest,
  observedCompletionBasisDigest: finalizationFixture.request.expectedCompletionBasisDigest,
  observedAt: finalizationFixture.completedAt,
  state: 'done',
  issueCount: 0,
  codeRevision: finalizationFixture.codeRevision,
  contextDigest: finalizationFixture.contextDigest,
  contextStatus: 'current'
}
it('revalidates only the exact reviewed record and strips source bodies and caller authority', async () => {
  mocks.callTool.mockResolvedValue({ ...revalidation, evidenceText: 'private body' })
  const result = await call('revalidateFinalization', {
    ...revalidationRequest,
    hostToken: 'forged',
    approval: 'forged'
  })
  expect(result).toMatchObject({ ok: true, result: revalidation })
  expect(JSON.stringify(result)).not.toContain('private body')
  expect(mocks.callTool).toHaveBeenCalledExactlyOnceWith(
    'kontext_revalidate_finalization',
    revalidationRequest
  )
})
it.each([
  { taskId: 'other-task' },
  { recordId: `sha256:${'e'.repeat(64)}` },
  { observedCompletionBasisDigest: `sha256:${'e'.repeat(64)}` },
  { state: 'blocked' },
  { contextStatus: 'stale' },
  { issueCount: 1 },
  { currentEvidence: 'future-claim' }
])('refuses identity or current-completion contradictions: %j', async (override) => {
  mocks.callTool.mockResolvedValue({ ...revalidation, ...override })
  expect(await call('revalidateFinalization', revalidationRequest)).toMatchObject({ ok: false })
  expect(mocks.callTool).toHaveBeenCalledOnce()
})
it('preserves changed evidence and refuses missing support or cancellation without replay', async () => {
  mocks.callTool.mockResolvedValue({
    ...revalidation,
    currentEvidence: 'changed',
    state: 'blocked',
    contextStatus: 'stale'
  })
  expect(await call('revalidateFinalization', revalidationRequest)).toMatchObject({
    ok: true,
    result: { currentEvidence: 'changed', state: 'blocked' }
  })
  expect(await call('revalidateFinalization', revalidationRequest, true)).toMatchObject({
    ok: false,
    error: { code: 'method_not_found' }
  })
  const controller = new AbortController()
  controller.abort()
  expect(
    await call('revalidateFinalization', revalidationRequest, false, controller.signal)
  ).toMatchObject({ ok: false })
  expect(mocks.callTool).toHaveBeenCalledOnce()
  const late = new AbortController()
  mocks.callTool.mockImplementationOnce(async () => {
    late.abort()
    return revalidation
  })
  expect(
    await call('revalidateFinalization', revalidationRequest, false, late.signal)
  ).toMatchObject({ ok: false })
  expect(mocks.callTool).toHaveBeenCalledTimes(2)
})
