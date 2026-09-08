import { beforeEach, expect, it, vi } from 'vitest'
import { taskInventoryFixture as inventory } from '../../../../shared/__fixtures__/kontext-task-inventory'
import type { OrcaRuntimeService } from '../../orca-runtime'
import { RpcDispatcher } from '../dispatcher'
import { kontextTaskInventoryMethod } from './kontext-task-inventory'

const mocks = vi.hoisted(() => ({ callTool: vi.fn(), getService: vi.fn() }))
vi.mock('../../../kontext/kontext-sidecar-runtime', () => ({
  getKontextSidecarService: mocks.getService
}))
function call(params: unknown, signal?: AbortSignal, legacy = false) {
  return new RpcDispatcher({
    runtime: { getRuntimeId: () => 'owning-host' } as unknown as OrcaRuntimeService,
    methods: legacy ? [] : [kontextTaskInventoryMethod]
  }).dispatch({ id: 'test', authToken: 'fixture', method: 'kontext.listTasks', params }, { signal })
}
beforeEach(() => {
  mocks.callTool.mockReset().mockResolvedValue(inventory)
  mocks.getService.mockReset().mockReturnValue({ callTool: mocks.callTool })
})
it('reads the owning runtime and strips caller authority and unexpected private returned fields', async () => {
  mocks.callTool.mockResolvedValue({
    ...inventory,
    hostToken: 'private',
    tasks: inventory.tasks.map((task) => ({
      ...task,
      body: 'PRIVATE_SOURCE',
      prompt: 'PRIVATE_PROMPT'
    }))
  })
  expect(
    await call({ hostToken: 'forged', subjectId: 'forged', directory: '/client' })
  ).toMatchObject({
    ok: true,
    result: inventory
  })
  expect(mocks.callTool).toHaveBeenCalledExactlyOnceWith('kontext_list_tasks', { limit: 50 })
  expect(mocks.getService).toHaveBeenCalledExactlyOnceWith('owning-host')
  expect(JSON.stringify(await call({}))).not.toContain('PRIVATE_')
})
it.each([
  { ...inventory, currentEvidence: 'revalidated_current' },
  { ...inventory, tasks: [...inventory.tasks, ...inventory.tasks] },
  { ...inventory, tasks: inventory.tasks.map((row) => ({ ...row, unsettledScheduleCount: 2 })) },
  { ...inventory, tasks: inventory.tasks.map((row) => ({ ...row, latestSchedule: null })) },
  {
    ...inventory,
    tasks: inventory.tasks.map((row) => ({
      ...row,
      latestSchedule: { ...row.latestSchedule, taskId: 'wrong' }
    }))
  },
  {
    ...inventory,
    tasks: inventory.tasks.map((row) => ({
      ...row,
      latestSchedule: { ...row.latestSchedule, status: 'unknown' }
    }))
  },
  { ...inventory, nextCursor: { digest: inventory.inventoryDigest, offset: 50 } }
])('refuses contradictory or unsupported metadata without fallback', async (response) => {
  mocks.callTool.mockResolvedValue(response)
  expect(await call({})).toMatchObject({ ok: false })
  expect(mocks.callTool).toHaveBeenCalledTimes(1)
})
it('checks filters, digest-bound cursors, page size and next offsets', async () => {
  expect(await call({ workspaceId: 'folder:other' })).toMatchObject({ ok: false })
  expect(await call({ cursor: { digest: `sha256:${'b'.repeat(64)}`, offset: 1 } })).toMatchObject({
    ok: false
  })
  mocks.callTool.mockResolvedValue({
    ...inventory,
    nextCursor: { digest: inventory.inventoryDigest, offset: 2 }
  })
  expect(await call({ limit: 1 })).toMatchObject({ ok: false })
  expect(
    await call({ limit: 1, cursor: { digest: inventory.inventoryDigest, offset: 1 } })
  ).toMatchObject({ ok: true })
})
it('refuses invalid requests and an older host without reading a local substitute', async () => {
  expect(await call({ limit: 101 })).toMatchObject({
    ok: false,
    error: { code: 'invalid_argument' }
  })
  expect(await call({}, undefined, true)).toMatchObject({
    ok: false,
    error: { code: 'method_not_found' }
  })
  expect(mocks.callTool).not.toHaveBeenCalled()
})
it('refuses cancelled work and discards results cancelled during observation', async () => {
  const before = new AbortController()
  before.abort()
  expect(await call({}, before.signal)).toMatchObject({ ok: false })
  expect(mocks.callTool).not.toHaveBeenCalled()
  const during = new AbortController()
  mocks.callTool.mockImplementation(async () => {
    during.abort()
    return inventory
  })
  expect(await call({}, during.signal)).toMatchObject({ ok: false })
})
