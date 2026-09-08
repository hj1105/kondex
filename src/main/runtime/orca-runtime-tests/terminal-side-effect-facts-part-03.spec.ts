import { describe, expect, it, vi } from 'vitest'
import { syncSinglePty } from '../orca-runtime-test-fixtures.spec'
import { createSideEffectRuntime } from '../orca-runtime-test-scenario-builders.spec'
import '../orca-runtime-test-mocks.spec'

describe('terminal side-effect fact channel', () => {
  it('arms the stale-title timer for a seeded working title', async () => {
    vi.useFakeTimers()
    try {
      const { runtime, batches } = createSideEffectRuntime()
      const serializeBuffer = vi.fn().mockResolvedValue({
        data: 'restored scrollback\n',
        cols: 80,
        rows: 24,
        lastTitle: 'Codex working'
      })
      runtime.setPtyController({
        write: () => true,
        kill: () => true,
        getForegroundProcess: async () => null,
        serializeBuffer,
        hasRendererSerializer: () => true,
        getSize: () => ({ cols: 80, rows: 24 })
      })
      syncSinglePty(runtime)

      runtime.onPtyData('pty-1', 'plain output\n', 100)
      // Settle the async daemon-snapshot hydration that seeds the tracker.
      await vi.advanceTimersByTimeAsync(0)
      runtime.onPtyData('pty-1', 'still no title\n', 101)
      batches.length = 0

      await vi.advanceTimersByTimeAsync(3_000)

      expect(batches.flatMap((batch) => batch.facts)).toEqual([
        {
          kind: 'title',
          normalizedTitle: 'Codex',
          rawTitle: 'Codex',
          staleWorkingTitleClear: true
        },
        { kind: 'agent-idle', title: 'Codex', staleWorkingTitleClear: true }
      ])
    } finally {
      vi.useRealTimers()
    }
  })

  it('prefers the tracked title over a stale renderer lastTitle in the hydration seed', async () => {
    const { runtime } = createSideEffectRuntime()
    const serializeBuffer = vi.fn().mockResolvedValue({
      data: 'renderer scrollback\n',
      cols: 80,
      rows: 24,
      // Renderer xterm never saw the synthetic hook frame (no longer rides pty:data), so its serializer reports the pre-agent title.
      lastTitle: 'stale shell title'
    })
    runtime.setPtyController({
      write: () => true,
      kill: () => true,
      getForegroundProcess: async () => null,
      serializeBuffer,
      hasRendererSerializer: () => true,
      getSize: () => ({ cols: 80, rows: 24 })
    })
    syncSinglePty(runtime)

    runtime.ingestSyntheticTitleFrame('pty-1', '\x1b]0;⠋ Claude working\x07')
    // First live chunk kicks off renderer hydration; awaiting the snapshot below settles the seed write chain.
    runtime.onPtyData('pty-1', 'plain output\n', 100)
    await runtime.serializeMainTerminalBuffer('pty-1', { scrollbackRows: 10 })

    const leaves = (runtime as unknown as { leaves: Map<string, { lastOscTitle: string | null }> })
      .leaves
    // The seed must not stomp the leaf record (worktree ps status source) back to the renderer's stale title.
    expect([...leaves.values()][0]?.lastOscTitle).toBe('⠋ Claude working')
  })
})
