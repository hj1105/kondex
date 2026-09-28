import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pollOntologyProgress } from './kontext-ontology-progress-poll'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('@/runtime/runtime-rpc-client', () => ({ callRuntimeRpc: mocks.rpc }))

function record(finished: boolean): Record<string, unknown> {
  return {
    phase: 'embed',
    done: 0,
    total: 0,
    message: 'download tokenizer.json',
    configPath: '/ws/kontext.yaml',
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    finished
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  mocks.rpc.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('pollOntologyProgress', () => {
  it('reports a running build', async () => {
    mocks.rpc.mockResolvedValue(record(false))
    const onProgress = vi.fn()
    const stop = pollOntologyProgress({ kind: 'local' }, 'ws', onProgress)
    await vi.advanceTimersByTimeAsync(2_000)
    stop()
    expect(onProgress).toHaveBeenCalledTimes(1)
  })

  it('ignores the record a finished build leaves behind', async () => {
    // It keeps the last event, which put "0/0 MB" back under the saved result.
    mocks.rpc.mockResolvedValue(record(true))
    const onProgress = vi.fn()
    const stop = pollOntologyProgress({ kind: 'local' }, 'ws', onProgress)
    await vi.advanceTimersByTimeAsync(2_000)
    stop()
    expect(onProgress).not.toHaveBeenCalled()
  })

  it('drops an answer that lands after polling stopped', async () => {
    let answer: (value: unknown) => void = () => undefined
    mocks.rpc.mockImplementation(() => new Promise((resolve) => (answer = resolve)))
    const onProgress = vi.fn()
    const stop = pollOntologyProgress({ kind: 'local' }, 'ws', onProgress)
    await vi.advanceTimersByTimeAsync(2_000)
    stop()
    answer(record(false))
    await vi.advanceTimersByTimeAsync(0)
    expect(onProgress).not.toHaveBeenCalled()
  })
})
