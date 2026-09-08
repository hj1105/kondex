import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OrcaRuntimeService } from '../../orca-runtime'
import { RpcDispatcher } from '../dispatcher'
import { KONTEXT_METHODS } from './kontext'

const mocks = vi.hoisted(() => ({ callTool: vi.fn() }))
vi.mock('../../../kontext/kontext-sidecar-runtime', () => ({
  getKontextSidecarService: () => ({ callTool: mocks.callTool })
}))
const metadata = {
  taskId: 'task:one',
  status: 'unprepared',
  contract: null,
  codeRevision: 'revision:one',
  contextDigest: null,
  requiredEvidenceIds: [],
  normativeRevisionCount: 0,
  conflictCount: 0,
  logic: []
}
function call(params: unknown, signal?: AbortSignal) {
  const dispatcher = new RpcDispatcher({
    runtime: { getRuntimeId: () => 'fixture-host' } as unknown as OrcaRuntimeService,
    methods: KONTEXT_METHODS
  })
  return dispatcher.dispatch(
    { id: 'request:one', authToken: 'fixture', method: 'kontext.inspectTask', params },
    { signal }
  )
}
beforeEach(() => {
  mocks.callTool.mockReset().mockResolvedValue(metadata)
})
describe('Kontext task inspection RPC', () => {
  it('returns registered metadata without forwarding additive source bodies', async () => {
    mocks.callTool.mockResolvedValue({ ...metadata, evidenceText: 'private source' })
    expect(await call({ taskId: metadata.taskId })).toMatchObject({ ok: true, result: metadata })
    expect(JSON.stringify(await call({ taskId: metadata.taskId }))).not.toContain('private source')
    expect(mocks.callTool).toHaveBeenCalledWith('kontext_inspect_task', { taskId: metadata.taskId })
  })
  it('rejects a different task identity', async () => {
    mocks.callTool.mockResolvedValue({ ...metadata, taskId: 'task:other' })
    expect(await call({ taskId: metadata.taskId })).toMatchObject({ ok: false })
  })
  it('rejects a different contract identity', async () => {
    mocks.callTool.mockResolvedValue({
      ...metadata,
      contract: {
        taskId: 'task:other',
        intent: 'Other task',
        risk: 'low',
        targets: ['symbol:one'],
        nonGoals: [],
        acceptance: [
          {
            criterionId: 'test:one',
            statement: 'Pass test',
            verifier: { kind: 'test', ref: 'fixture:test' }
          }
        ]
      }
    })
    expect(await call({ taskId: metadata.taskId })).toMatchObject({ ok: false })
  })
  it('never treats a future unknown context state as current', async () => {
    mocks.callTool.mockResolvedValue({ ...metadata, status: 'future-state' })
    expect(await call({ taskId: metadata.taskId })).toMatchObject({ ok: false })
  })
  it('rejects missing task identity without starting a sidecar', async () => {
    expect(await call({})).toMatchObject({ ok: false, error: { code: 'invalid_argument' } })
    expect(mocks.callTool).not.toHaveBeenCalled()
  })
  it('does not retry or prepare a missing task', async () => {
    mocks.callTool.mockRejectedValue(new Error('Task not registered'))
    expect(await call({ taskId: metadata.taskId })).toMatchObject({ ok: false })
    expect(mocks.callTool).toHaveBeenCalledTimes(1)
  })
  it('does not contact the sidecar after caller cancellation', async () => {
    const controller = new AbortController()
    controller.abort()
    expect(await call({ taskId: metadata.taskId }, controller.signal)).toMatchObject({ ok: false })
    expect(mocks.callTool).not.toHaveBeenCalled()
  })
})
