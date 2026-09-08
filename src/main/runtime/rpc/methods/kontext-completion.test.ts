import { beforeEach, expect, it, vi } from 'vitest'
import { completionFixture } from '../../../../shared/__fixtures__/kontext-completion'
import type { OrcaRuntimeService } from '../../orca-runtime'
import { RpcDispatcher } from '../dispatcher'
import { kontextCompletionMethod } from './kontext-completion'
const mocks = vi.hoisted(() => ({ callTool: vi.fn() }))
vi.mock('../../../kontext/kontext-sidecar-runtime', () => ({
  getKontextSidecarService: () => ({ callTool: mocks.callTool })
}))
const request = { taskId: completionFixture.taskId, jobId: completionFixture.jobId }
function call(params: unknown = request, signal?: AbortSignal, legacy = false) {
  return new RpcDispatcher({
    runtime: { getRuntimeId: () => 'host' } as unknown as OrcaRuntimeService,
    methods: legacy ? [] : [kontextCompletionMethod]
  }).dispatch(
    { id: 'test', authToken: 'fixture', method: 'kontext.assessCompletion', params },
    { signal }
  )
}
beforeEach(() => {
  mocks.callTool.mockReset().mockResolvedValue(completionFixture)
})
it('sends only Task and schedule selectors to the owning host and strips unpublished fields', async () => {
  mocks.callTool.mockResolvedValue({
    ...completionFixture,
    hostToken: 'secret',
    sourceBody: 'private'
  })
  const result = await call({
    ...request,
    evidence: ['forged'],
    invariantEvaluations: ['forged'],
    currentState: 'done',
    workspacePath: '/client',
    hostToken: 'forged'
  })
  expect(result).toMatchObject({ ok: true, result: completionFixture })
  expect(mocks.callTool).toHaveBeenCalledExactlyOnceWith('kontext_assess_completion', request)
  expect(JSON.stringify(result)).not.toMatch(/secret|private|forged/)
})
it('refuses mismatched identity or unsupported successful evidence', async () => {
  for (const change of [
    { taskId: 'other' },
    { jobId: 'other' },
    { accuracyManifest: undefined },
    { issues: [{ code: 'missing_commit', message: 'missing' }] },
    { context: { status: 'stale', contextDigest: 'context:one' } },
    { accuracyManifest: { ...completionFixture.accuracyManifest, resultCodeRevision: 'other' } }
  ]) {
    mocks.callTool.mockResolvedValue({ ...completionFixture, ...change })
    expect(await call()).toMatchObject({ ok: false })
  }
  expect(mocks.callTool).toHaveBeenCalledTimes(6)
})
it('does not retry or substitute a local answer on unavailable, cancelled, or legacy hosts', async () => {
  const controller = new AbortController()
  controller.abort()
  expect(await call(request, controller.signal)).toMatchObject({ ok: false })
  expect(await call(request, undefined, true)).toMatchObject({
    ok: false,
    error: { code: 'method_not_found' }
  })
  expect(mocks.callTool).not.toHaveBeenCalled()
  mocks.callTool.mockRejectedValue(new Error('contact lost'))
  expect(await call()).toMatchObject({ ok: false })
  expect(mocks.callTool).toHaveBeenCalledTimes(1)
})
