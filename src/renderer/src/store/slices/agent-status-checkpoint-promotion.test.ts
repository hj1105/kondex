import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SleepingAgentSessionRecord } from '../../../../shared/agent-session-resume'
import { collectSleepingAgentSessionRecordsForWorktree } from './agent-status-recovery-collection'
import { createTestStore, makeTab } from './store-test-helpers'

const NOW = 1_800_000_000_000
const PANE_KEY = 'tab-1:leaf-1'

function checkpoint(
  overrides: Partial<SleepingAgentSessionRecord> = {}
): SleepingAgentSessionRecord {
  return {
    paneKey: PANE_KEY,
    tabId: 'tab-1',
    worktreeId: 'wt-1',
    agent: 'codex',
    providerSession: {
      key: 'session_id',
      id: 'checkpoint-session',
      transcriptPath: '/remote/transcript.jsonl'
    },
    prompt: 'saved prompt',
    state: 'working',
    capturedAt: 10,
    updatedAt: 20,
    origin: 'live',
    connectionId: 'remote-connection',
    automaticResumeBlockedBy: 'legacy-orchestration-worker',
    launchConfig: { agentArgs: '--model saved-model', agentEnv: { SAVED_PROFILE: 'fixture' } },
    ...overrides
  }
}

function storeWithCheckpoint(record = checkpoint()) {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  const store = createTestStore()
  store.setState({
    tabsByWorktree: { 'wt-1': [makeTab({ id: 'tab-1', worktreeId: 'wt-1' })] },
    sleepingAgentSessionsByPaneKey: { [record.paneKey]: record }
  })
  return store
}

afterEach(() => vi.useRealTimers())

describe('manual sleep checkpoint promotion', () => {
  it.each(['claude', 'codex'] as const)(
    'preserves the sole %s recovery handle without a live row',
    (agent) => {
      const original = checkpoint({ agent })
      const store = storeWithCheckpoint(original)

      store.getState().captureSleepingAgentSessionsByWorktree('wt-1')

      expect(store.getState().sleepingAgentSessionsByPaneKey[PANE_KEY]).toEqual({
        ...original,
        capturedAt: NOW,
        updatedAt: NOW,
        origin: 'worktree-sleep'
      })
      expect(original.origin).toBe('live')
      expect(original.updatedAt).toBe(20)
    }
  )

  it('keeps a completed checkpoint passive until its tab is opened', () => {
    const original = checkpoint({ state: 'done', connectionId: null })
    const store = storeWithCheckpoint(original)

    store.getState().captureSleepingAgentSessionsByWorktree('wt-1')

    expect(store.getState().sleepingAgentSessionsByPaneKey[PANE_KEY]).toEqual({
      ...original,
      capturedAt: NOW,
      updatedAt: NOW,
      origin: 'worktree-sleep',
      restoreOnTabOpenOnly: true
    })
  })

  it('does not let an old checkpoint replace the current live session', () => {
    const store = storeWithCheckpoint()
    store.setState({
      agentStatusByPaneKey: {
        [PANE_KEY]: {
          paneKey: PANE_KEY,
          worktreeId: 'wt-1',
          agentType: 'claude',
          state: 'done',
          prompt: 'current prompt',
          updatedAt: NOW,
          stateStartedAt: NOW,
          stateHistory: [],
          providerSession: { key: 'session_id', id: 'current-session' },
          connectionId: 'current-connection'
        }
      }
    })

    store.getState().captureSleepingAgentSessionsByWorktree('wt-1')

    const record = store.getState().sleepingAgentSessionsByPaneKey[PANE_KEY]
    expect(record).toMatchObject({
      agent: 'claude',
      state: 'done',
      providerSession: { key: 'session_id', id: 'current-session' },
      connectionId: 'current-connection',
      restoreOnTabOpenOnly: true
    })
    expect(record.automaticResumeBlockedBy).toBeUndefined()
  })

  it('does not touch checkpoints outside the requested workspace or pane selection', () => {
    const original = checkpoint()
    const store = storeWithCheckpoint(original)

    store.getState().captureSleepingAgentSessionsByWorktree('wt-other')
    expect(store.getState().sleepingAgentSessionsByPaneKey[PANE_KEY]).toBe(original)
    store.getState().captureSleepingAgentSessionsByWorktree('wt-1', ['tab-1:other-leaf'])
    expect(store.getState().sleepingAgentSessionsByPaneKey[PANE_KEY]).toBe(original)
  })

  it('discards a provisional checkpoint with an unsupported resume key', () => {
    const store = storeWithCheckpoint(
      checkpoint({
        providerSession: { key: 'conversation_id', id: 'invalid-resume-target' }
      })
    )

    store.getState().captureSleepingAgentSessionsByWorktree('wt-1')

    expect(store.getState().sleepingAgentSessionsByPaneKey[PANE_KEY]).toBeUndefined()
  })

  it('does not promote a checkpoint during automatic completed-agent hibernation', () => {
    const store = storeWithCheckpoint()

    expect(
      collectSleepingAgentSessionRecordsForWorktree(store.getState(), 'wt-1', {
        captureMode: 'completed-agent-hibernation'
      })
    ).toEqual({})
  })
})
