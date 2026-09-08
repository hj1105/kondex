// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { sourceInventoryFixture as inventory } from '../../../../shared/__fixtures__/kontext-source-inventory'
import { sessionSourcePreviewFixture } from '../../../../shared/__fixtures__/kontext-session-source'
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), revision: 1 }))
vi.mock('@/runtime/runtime-rpc-client', () => ({ callRuntimeRpc: mocks.rpc }))
vi.mock('@/runtime/runtime-environment-revision', () => ({
  getRuntimeEnvironmentRevision: () => mocks.revision
}))
import { useKontextSourceInventory } from './use-kontext-source-inventory'
const owner = { kind: 'environment' as const, environmentId: 'peer:one', pairingRevision: 1 }
beforeEach(() => {
  mocks.revision = 1
  mocks.rpc.mockReset().mockResolvedValue(inventory)
})
afterEach(cleanup)
it('accepts confirmed native inclusion but keeps legacy scope unconfirmed and refuses unacknowledged native rows', async () => {
  const {
    workspacePath: _workspacePath,
    relativePath: _relativePath,
    ...metadata
  } = inventory.sources[0] as (typeof inventory.sources)[0] & {
    workspacePath: string
    relativePath: string
  }
  const native = {
    ...metadata,
    sourceKind: 'native_session',
    nativeSession: sessionSourcePreviewFixture.origin
  }
  const { result } = renderHook(() => useKontextSourceInventory(owner))
  mocks.rpc.mockResolvedValueOnce({ ...inventory, sources: [native], nativeSessionsIncluded: true })
  await act(() => result.current.load())
  expect(result.current.page?.sources).toHaveLength(1)
  expect(result.current.page?.nativeSessionsIncluded).toBe(true)
  mocks.rpc.mockResolvedValueOnce(inventory)
  await act(() => result.current.load())
  expect(result.current.page?.nativeSessionsIncluded).toBeUndefined()
  expect(result.current.failed).toBe(false)
  mocks.rpc.mockResolvedValueOnce({ ...inventory, sources: [native] })
  await act(() => result.current.load())
  expect(result.current.page).toBeNull()
  expect(result.current.failed).toBe(true)
})
it('does not read on mount and reads metadata only after an explicit request', async () => {
  const { result } = renderHook(() => useKontextSourceInventory(owner))
  expect(mocks.rpc).not.toHaveBeenCalled()
  await act(() => result.current.load())
  expect(result.current.page).toEqual(inventory)
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith(
    owner,
    'kontext.listSources',
    { limit: 50, includeNativeSessions: true },
    { expectedEnvironmentPairingRevision: 1, timeoutMs: 60_000 }
  )
})
it('appends exact-digest pages and clears the display on changed evidence instead of mixing snapshots', async () => {
  const sources = Array.from({ length: 50 }, (_, index) => ({
    ...inventory.sources[0],
    resourceId: `resource:${index}`
  }))
  const nextCursor = { digest: inventory.inventoryDigest, offset: 50 }
  const { result } = renderHook(() => useKontextSourceInventory(owner))
  mocks.rpc.mockResolvedValueOnce({ ...inventory, sources, nextCursor })
  await act(() => result.current.load())
  await act(() => result.current.load(true))
  expect(result.current.page?.sources).toHaveLength(51)
  expect(mocks.rpc.mock.calls[1][2]).toEqual({
    limit: 50,
    includeNativeSessions: true,
    cursor: nextCursor
  })
  mocks.rpc.mockResolvedValueOnce({ ...inventory, sources, nextCursor })
  await act(() => result.current.load())
  mocks.rpc.mockResolvedValueOnce({ ...inventory, inventoryDigest: `sha256:${'c'.repeat(64)}` })
  await act(() => result.current.load(true))
  expect(result.current.page).toBeNull()
  expect(result.current.failed).toBe(true)
  expect(mocks.rpc).toHaveBeenCalledTimes(4)
})
it('suppresses duplicate requests and refuses a late result after re-pairing', async () => {
  let resolve: (value: unknown) => void = () => {
    throw new Error('Missing fixture promise')
  }
  mocks.rpc.mockReturnValue(
    new Promise((done) => {
      resolve = done
    })
  )
  const { result } = renderHook(() => useKontextSourceInventory(owner))
  let pending: Promise<void> | undefined
  act(() => {
    pending = result.current.load()
  })
  await act(() => result.current.load())
  expect(mocks.rpc).toHaveBeenCalledTimes(1)
  mocks.revision = 2
  await act(async () => {
    resolve(inventory)
    await pending
  })
  expect(result.current.page).toBeNull()
  expect(result.current.failed).toBe(true)
  await act(() => result.current.load())
  expect(mocks.rpc).toHaveBeenCalledTimes(1)
})
it('does not retain previously shown permissions after a failed refresh', async () => {
  const { result } = renderHook(() => useKontextSourceInventory(owner))
  await act(() => result.current.load())
  mocks.rpc.mockRejectedValueOnce(new Error('private details'))
  await act(() => result.current.load())
  expect(result.current.page).toBeNull()
  expect(result.current.failed).toBe(true)
  expect(JSON.stringify(result.current)).not.toContain('private details')
})
