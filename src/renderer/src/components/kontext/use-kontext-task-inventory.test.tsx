// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { taskInventoryFixture as inventory } from '../../../../shared/__fixtures__/kontext-task-inventory'
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), revision: 1 }))
vi.mock('@/runtime/runtime-rpc-client', () => ({ callRuntimeRpc: mocks.rpc }))
vi.mock('@/runtime/runtime-environment-revision', () => ({
  getRuntimeEnvironmentRevision: () => mocks.revision
}))
import { useKontextTaskInventory } from './use-kontext-task-inventory'
const owner = { kind: 'environment' as const, environmentId: 'peer:one', pairingRevision: 1 }
beforeEach(() => {
  mocks.revision = 1
  mocks.rpc.mockReset().mockResolvedValue(inventory)
})
afterEach(cleanup)
it('does not read on mount and reads metadata only after an explicit request', async () => {
  const { result } = renderHook(() => useKontextTaskInventory(owner))
  expect(mocks.rpc).not.toHaveBeenCalled()
  await act(() => result.current.load())
  expect(result.current.page).toEqual(inventory)
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith(
    owner,
    'kontext.listTasks',
    { limit: 50 },
    { expectedEnvironmentPairingRevision: 1, timeoutMs: 60_000 }
  )
})
it('appends exact-digest pages and clears the display on changed evidence instead of mixing snapshots', async () => {
  const tasks = Array.from({ length: 50 }, (_, index) => ({
    ...inventory.tasks[0],
    taskId: `task:${index}`,
    latestSchedule: null,
    scheduleCount: 0
  }))
  const nextCursor = { digest: inventory.inventoryDigest, offset: 50 }
  const { result } = renderHook(() => useKontextTaskInventory(owner))
  mocks.rpc.mockResolvedValueOnce({ ...inventory, tasks, nextCursor })
  await act(() => result.current.load())
  await act(() => result.current.load(true))
  expect(result.current.page?.tasks).toHaveLength(51)
  expect(mocks.rpc.mock.calls[1][2]).toEqual({
    limit: 50,
    cursor: nextCursor
  })
  mocks.rpc.mockResolvedValueOnce({ ...inventory, tasks, nextCursor })
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
  const { result } = renderHook(() => useKontextTaskInventory(owner))
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
it('does not retain previously shown Task records after a failed refresh', async () => {
  const { result } = renderHook(() => useKontextTaskInventory(owner))
  await act(() => result.current.load())
  mocks.rpc.mockRejectedValueOnce(new Error('private details'))
  await act(() => result.current.load())
  expect(result.current.page).toBeNull()
  expect(result.current.failed).toBe(true)
  expect(JSON.stringify(result.current)).not.toContain('private details')
})
