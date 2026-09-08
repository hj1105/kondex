import { beforeEach, expect, it, vi } from 'vitest'
import type { OrcaRuntimeService } from '../../orca-runtime'
import { RpcDispatcher } from '../dispatcher'
import { kontextSourceManagementMethods } from './kontext-source'
const mocks = vi.hoisted(() => ({ callTool: vi.fn() }))
vi.mock('../../../kontext/kontext-sidecar-runtime', () => ({
  getKontextSidecarService: () => ({ callTool: mocks.callTool })
}))
const source = {
  organizationId: '8f424832-cd0f-4582-bfac-360e8704d302',
  resourceId: 'resource:one',
  title: 'notes.md',
  workspacePath: '/host/folder',
  relativePath: 'notes.md',
  contentHash: `sha256:${'a'.repeat(64)}`,
  revision: 2,
  status: 'active',
  sharing: { dataClassification: 'internal', allowedRuntimeProviders: ['codex'] },
  normativeApproval: 'not_granted'
}
const request = {
  resourceId: source.resourceId,
  expectedRevision: 1,
  expectedContentHash: source.contentHash,
  dataClassification: 'internal',
  allowedRuntimeProviders: ['codex']
}
function call(method: string, params: unknown, signal?: AbortSignal, legacy = false) {
  return new RpcDispatcher({
    runtime: { getRuntimeId: () => 'host' } as unknown as OrcaRuntimeService,
    methods: legacy ? [] : kontextSourceManagementMethods
  }).dispatch({ id: 'test', authToken: 'fixture', method: `kontext.${method}`, params }, { signal })
}
beforeEach(() => mocks.callTool.mockReset().mockResolvedValue(source))
it('projects metadata and strips caller authority from the explicit sharing request', async () => {
  mocks.callTool.mockResolvedValue({
    ...source,
    body: 'private body',
    hostToken: 'private capability'
  })
  const response = await call('setSourceSharing', {
    ...request,
    hostToken: 'forged',
    subjectId: 'forged',
    workspacePath: '/other'
  })
  expect(response).toMatchObject({ ok: true, result: source })
  expect(mocks.callTool).toHaveBeenCalledExactlyOnceWith('kontext_set_source_sharing', request)
  expect(JSON.stringify(response)).not.toMatch(/private body|private capability/)
})
it.each([
  { ...source, resourceId: 'other' },
  { ...source, revision: 3 },
  { ...source, contentHash: `sha256:${'b'.repeat(64)}` },
  { ...source, sharing: null },
  { ...source, sharing: { dataClassification: 'internal', allowedRuntimeProviders: ['claude'] } },
  { ...source, normativeApproval: 'approved' }
])('rejects mismatched sharing confirmation without retrying', async (response) => {
  mocks.callTool.mockResolvedValue(response)
  expect(await call('setSourceSharing', request)).toMatchObject({ ok: false })
  expect(mocks.callTool).toHaveBeenCalledTimes(1)
})
it('refreshes only the saved Resource ID on the owning host and then reads its new metadata', async () => {
  mocks.callTool
    .mockResolvedValueOnce({
      organizationId: source.organizationId,
      resourceId: source.resourceId,
      title: source.title,
      contentHash: source.contentHash,
      changed: false,
      evidence: [],
      providerSharing: 'not_granted',
      normativeApproval: 'not_granted'
    })
    .mockResolvedValueOnce(source)
  expect(
    await call('refreshSource', { resourceId: source.resourceId, workspacePath: '/client/path' })
  ).toMatchObject({ ok: true, result: source })
  expect(mocks.callTool.mock.calls).toEqual([
    ['kontext_refresh_source', { resourceId: source.resourceId }],
    ['kontext_inspect_source', { resourceId: source.resourceId }]
  ])
})
it('does not mutate after cancellation or fall back when an older host lacks these methods', async () => {
  const controller = new AbortController()
  controller.abort()
  expect(await call('setSourceSharing', request, controller.signal)).toMatchObject({ ok: false })
  expect(await call('setSourceSharing', request, undefined, true)).toMatchObject({
    ok: false,
    error: { code: 'method_not_found' }
  })
  expect(mocks.callTool).not.toHaveBeenCalled()
})
it.each([
  { ...request, expectedRevision: undefined },
  { ...request, allowedRuntimeProviders: ['unknown'] }
])('requires the exact revision and a supported provider', async (params) => {
  expect(await call('setSourceSharing', params)).toMatchObject({
    ok: false,
    error: { code: 'invalid_argument' }
  })
  expect(mocks.callTool).not.toHaveBeenCalled()
})
