import { beforeEach, expect, it, vi } from 'vitest'
import { scheduleHistoryFixture as history } from '../../../../shared/__fixtures__/kontext-schedule-history'
import type { OrcaRuntimeService } from '../../orca-runtime'
import { RpcDispatcher } from '../dispatcher'
import { kontextRegisteredScheduleMethods } from './kontext-registered-schedule'
const mocks = vi.hoisted(() => ({ callTool: vi.fn(), getService: vi.fn() }))
vi.mock('../../../kontext/kontext-sidecar-runtime', () => ({
  getKontextSidecarService: mocks.getService
}))
function call(params: unknown = { taskId: history.taskId }, signal?: AbortSignal, legacy = false) {
  return new RpcDispatcher({
    runtime: { getRuntimeId: () => 'owning-host' } as unknown as OrcaRuntimeService,
    methods: legacy ? [] : kontextRegisteredScheduleMethods
  }).dispatch(
    { id: 'test', authToken: 'fixture', method: 'kontext.listRegisteredSchedules', params },
    { signal }
  )
}
beforeEach(() => {
  mocks.getService.mockReset().mockReturnValue({ callTool: mocks.callTool })
  mocks.callTool.mockReset().mockResolvedValue(history)
})
it('lists only the owning host, strips extra fields and does not start or inspect a job', async () => {
  mocks.callTool.mockResolvedValue({
    ...history,
    prompt: 'PRIVATE',
    schedules: history.schedules.map((job) => ({ ...job, diagnostic: 'PRIVATE' }))
  })
  const result = await call({ taskId: history.taskId, hostToken: 'forged', directory: '/client' })
  expect(result.ok).toBe(true)
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE|repositoryPath|resumeCount/)
  expect(mocks.callTool).toHaveBeenCalledExactlyOnceWith('kontext_list_registered_schedules', {
    taskId: history.taskId,
    limit: 50
  })
  expect(mocks.getService).toHaveBeenCalledExactlyOnceWith('owning-host')
})
it.each([
  { ...history, taskId: 'wrong' },
  { ...history, currentEvidence: 'current' },
  { ...history, schedules: [...history.schedules, history.schedules[0]] },
  { ...history, schedules: [{ ...history.schedules[0], taskId: 'wrong' }] },
  { ...history, schedules: [{ ...history.schedules[0], status: 'exited' }] },
  { ...history, nextCursor: { digest: history.inventoryDigest, offset: 50 } },
  { ...history, nextCursor: { digest: `sha256:${'b'.repeat(64)}`, offset: 2 } }
])('refuses unrelated, malformed or contradictory history', async (response) => {
  mocks.callTool.mockResolvedValue(response)
  expect(await call()).toMatchObject({ ok: false })
  expect(mocks.callTool).toHaveBeenCalledTimes(1)
})
it('binds pagination to its digest, limit and requested offset', async () => {
  mocks.callTool.mockResolvedValue({
    ...history,
    nextCursor: { digest: history.inventoryDigest, offset: 2 }
  })
  expect(await call({ taskId: history.taskId, limit: 2 })).toMatchObject({ ok: true })
  expect(await call({ taskId: history.taskId, limit: 1 })).toMatchObject({ ok: false })
  expect(
    await call({
      taskId: history.taskId,
      limit: 2,
      cursor: { digest: history.inventoryDigest, offset: 2 }
    })
  ).toMatchObject({ ok: false })
  mocks.callTool.mockResolvedValue(history)
  expect(
    await call({
      taskId: history.taskId,
      cursor: { digest: `sha256:${'b'.repeat(64)}`, offset: 2 }
    })
  ).toMatchObject({ ok: false })
})
it('does not fall back or replay on older hosts, transport failures or cancelled reads', async () => {
  expect(await call(undefined, undefined, true)).toMatchObject({
    ok: false,
    error: { code: 'method_not_found' }
  })
  const before = new AbortController()
  before.abort()
  expect(await call(undefined, before.signal)).toMatchObject({ ok: false })
  expect(mocks.callTool).not.toHaveBeenCalled()
  const during = new AbortController()
  mocks.callTool.mockImplementationOnce(async () => {
    during.abort()
    return history
  })
  expect(await call(undefined, during.signal)).toMatchObject({ ok: false })
  mocks.callTool.mockRejectedValueOnce(new Error('host disconnected'))
  expect(await call()).toMatchObject({ ok: false })
  expect(mocks.callTool).toHaveBeenCalledTimes(2)
})
