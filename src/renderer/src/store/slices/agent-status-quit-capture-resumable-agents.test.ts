import { describe, expect, it } from 'vitest'
import type { AppState } from '../types'
import { createTestStore, makeTab } from './store-test-helpers'

describe('quit-time capture for supported resumable agents', () => {
  it.each(['claude', 'codex'] as const)(
    'checkpoints a live %s provider session before quit-time capture',
    (agent) => {
      const store = createTestStore()
      store.setState({
        tabsByWorktree: {
          'wt-1': [makeTab({ id: 'tab-1', worktreeId: 'wt-1' })]
        }
      } as Partial<AppState>)

      store.getState().setAgentStatus(
        'tab-1:leaf-1',
        {
          state: 'working',
          prompt: 'finish the task',
          agentType: agent
        },
        agent === 'codex' ? 'Codex' : 'Claude Code',
        { updatedAt: 10, stateStartedAt: 10 },
        { tabId: 'tab-1', worktreeId: 'wt-1' },
        {
          providerSession: {
            key: 'session_id',
            id: 'session_431324d7-2165-42f0-9ecd-9f93437b3201'
          }
        }
      )

      // Why: each supported resumable provider must checkpoint its live session before
      // quit; otherwise restart drops the session instead of resuming it.
      expect(store.getState().sleepingAgentSessionsByPaneKey['tab-1:leaf-1']).toMatchObject({
        agent,
        worktreeId: 'wt-1',
        tabId: 'tab-1',
        providerSession: { key: 'session_id', id: 'session_431324d7-2165-42f0-9ecd-9f93437b3201' },
        origin: 'live'
      })
    }
  )
})
