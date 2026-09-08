import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OrcaRuntimeService } from '../../orca-runtime'
import { RpcDispatcher } from '../dispatcher'
import { KONTEXT_METHODS } from './kontext'

const mocks = vi.hoisted(() => ({ callTool: vi.fn(), resolve: vi.fn() }))
vi.mock('../../../kontext/kontext-sidecar-runtime', () => ({
  getKontextSidecarService: () => ({ callTool: mocks.callTool })
}))
const request = { workspace: 'id:folder:one', relativePath: 'docs/decisions.md' }
const result = {
  organizationId: '8f424832-cd0f-4582-bfac-360e8704d302',
  resourceId: 'resource:one',
  title: request.relativePath,
  contentHash: `sha256:${'a'.repeat(64)}`,
  changed: true,
  evidence: [{ resourceId: 'resource:one', evidenceId: 'evidence:one', chunkId: 'section:one' }],
  providerSharing: 'not_granted',
  normativeApproval: 'not_granted'
}
function call(params: unknown = request, signal?: AbortSignal, legacy = false) {
  return new RpcDispatcher({
    runtime: {
      getRuntimeId: () => 'fixture-host',
      resolveKontextSourceWorkspace: mocks.resolve
    } as unknown as OrcaRuntimeService,
    methods: legacy
      ? KONTEXT_METHODS.filter((item) => item.name !== 'kontext.registerMarkdownSource')
      : KONTEXT_METHODS
  }).dispatch(
    { id: 'fixture', authToken: 'fixture', method: 'kontext.registerMarkdownSource', params },
    { signal }
  )
}
beforeEach(() => {
  mocks.resolve.mockReset().mockResolvedValue('/host/Folder with spaces ')
  mocks.callTool.mockReset().mockResolvedValue(result)
})
describe('Kontext source registration RPC', () => {
  it('resolves the owning workspace and strips caller authority and response bodies', async () => {
    mocks.callTool.mockResolvedValue({
      ...result,
      body: 'private source',
      hostToken: 'private capability'
    })
    expect(
      await call({
        ...request,
        workspacePath: '/other',
        hostToken: 'caller token',
        providerSharing: 'granted'
      })
    ).toMatchObject({ ok: true, result })
    expect(mocks.resolve).toHaveBeenCalledExactlyOnceWith(request.workspace)
    expect(mocks.callTool).toHaveBeenCalledExactlyOnceWith('kontext_register_markdown_source', {
      workspacePath: '/host/Folder with spaces ',
      relativePath: request.relativePath
    })
    expect(JSON.stringify(await call())).not.toMatch(/private source|private capability/)
  })
  it.each([
    '../secret.md',
    '/secret.md',
    'C:\\secret.md',
    'file:secret.md',
    'docs//a.md',
    './a.md',
    'file.txt',
    'x\u0000.md'
  ])(
    'rejects invalid selection %s before resolving or starting the sidecar',
    async (relativePath) => {
      expect(await call({ ...request, relativePath })).toMatchObject({
        ok: false,
        error: { code: 'invalid_argument' }
      })
      expect(mocks.resolve).not.toHaveBeenCalled()
      expect(mocks.callTool).not.toHaveBeenCalled()
    }
  )
  it('accepts Windows relative separators while checking the normalized returned source', async () => {
    expect(await call({ ...request, relativePath: 'docs\\decisions.md' })).toMatchObject({
      ok: true
    })
  })
  it('preserves failed host resolution without a fallback or retry', async () => {
    mocks.resolve.mockRejectedValue(new Error('Host unavailable'))
    expect(await call()).toMatchObject({ ok: false })
    expect(mocks.callTool).not.toHaveBeenCalled()
  })
  it('does not start the mutation when cancellation arrives during resolution', async () => {
    const controller = new AbortController()
    mocks.resolve.mockImplementation(async () => {
      controller.abort()
      return '/host/path'
    })
    expect(await call(request, controller.signal)).toMatchObject({ ok: false })
    expect(mocks.callTool).not.toHaveBeenCalled()
  })
  it.each([
    { ...result, title: 'other.md' },
    { ...result, evidence: [{ ...result.evidence[0], resourceId: 'other' }] },
    { ...result, providerSharing: 'granted' },
    { ...result, normativeApproval: 'approved' }
  ])('rejects mismatched or authority-changing confirmation', async (response) => {
    mocks.callTool.mockResolvedValue(response)
    expect(await call()).toMatchObject({ ok: false })
    expect(mocks.callTool).toHaveBeenCalledTimes(1)
  })
  it('leaves a lost acknowledgement unknown and does not retry automatically', async () => {
    mocks.callTool.mockRejectedValue(new Error('Response lost'))
    expect(await call()).toMatchObject({ ok: false })
    expect(mocks.callTool).toHaveBeenCalledTimes(1)
  })
  it('new client against a server without this method receives an explicit unsupported response', async () => {
    expect(await call(request, undefined, true)).toMatchObject({
      ok: false,
      error: { code: 'method_not_found' }
    })
    expect(mocks.callTool).not.toHaveBeenCalled()
  })
})
