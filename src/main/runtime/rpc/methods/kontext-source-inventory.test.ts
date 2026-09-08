import { beforeEach, expect, it, vi } from 'vitest'
import { sourceInventoryFixture as inventory } from '../../../../shared/__fixtures__/kontext-source-inventory'
import type { OrcaRuntimeService } from '../../orca-runtime'
import { RpcDispatcher } from '../dispatcher'
import { kontextSourceManagementMethods } from './kontext-source'
const mocks = vi.hoisted(() => ({ callTool: vi.fn() }))
vi.mock('../../../kontext/kontext-sidecar-runtime', () => ({
  getKontextSidecarService: () => ({ callTool: mocks.callTool })
}))
function call(params: unknown, signal?: AbortSignal, legacy = false) {
  return new RpcDispatcher({
    runtime: { getRuntimeId: () => 'host' } as unknown as OrcaRuntimeService,
    methods: legacy ? [] : kontextSourceManagementMethods
  }).dispatch(
    { id: 'test', authToken: 'fixture', method: 'kontext.listSources', params },
    { signal }
  )
}
beforeEach(() => mocks.callTool.mockReset().mockResolvedValue(inventory))
it('reads only the owning host and strips caller authority and unexpected returned bodies', async () => {
  mocks.callTool.mockResolvedValue({
    ...inventory,
    hostToken: 'private',
    sources: inventory.sources.map((source) => ({ ...source, body: 'private source text' }))
  })
  expect(
    await call({ subjectId: 'forged', hostToken: 'forged', workspacePath: '/client' })
  ).toEqual({ id: 'test', ok: true, result: inventory, _meta: { runtimeId: 'host' } })
  expect(mocks.callTool).toHaveBeenCalledExactlyOnceWith('kontext_list_sources', { limit: 50 })
})
it.each([
  { ...inventory, sources: [...inventory.sources, ...inventory.sources] },
  {
    ...inventory,
    sources: inventory.sources.map((source) => ({
      ...source,
      organizationId: 'c6b28e55-6e95-4639-acf0-bf378a310b8b'
    }))
  },
  { ...inventory, nextCursor: { digest: inventory.inventoryDigest, offset: 50 } },
  { ...inventory, observation: 'live_file_check' }
])('refuses inconsistent metadata without fallback or retry', async (response) => {
  mocks.callTool.mockResolvedValue(response)
  expect(await call({})).toMatchObject({ ok: false })
  expect(mocks.callTool).toHaveBeenCalledTimes(1)
})
it('refuses changed pages, invalid limits and unsupported older hosts', async () => {
  expect(await call({ cursor: { digest: `sha256:${'c'.repeat(64)}`, offset: 1 } })).toMatchObject({
    ok: false
  })
  expect(await call({ limit: 101 })).toMatchObject({
    ok: false,
    error: { code: 'invalid_argument' }
  })
  expect(await call({}, undefined, true)).toMatchObject({
    ok: false,
    error: { code: 'method_not_found' }
  })
  expect(mocks.callTool).toHaveBeenCalledTimes(1)
})
it('does not read after cancellation and refuses a result if cancellation occurs while reading', async () => {
  const controller = new AbortController()
  controller.abort()
  expect(await call({}, controller.signal)).toMatchObject({ ok: false })
  expect(mocks.callTool).not.toHaveBeenCalled()
  const during = new AbortController()
  mocks.callTool.mockImplementation(async () => {
    during.abort()
    return inventory
  })
  expect(await call({}, during.signal)).toMatchObject({ ok: false })
})
