import { describe, expect, it } from 'vitest'
import type { SleepingAgentSessionRecord } from '../../../../shared/agent-session-resume'
import type { AppState } from '../types'
import { getProviderSessionClaimKey } from '../../lib/sleeping-agent-pane-ownership'
import { createTestStore, makeTab } from './store-test-helpers'

const SUPPORTED_AGENT_CASES = [
  { agent: 'codex' as const, label: 'Codex' },
  { agent: 'claude' as const, label: 'Claude' }
]

function makeProviderSession(agent: 'claude' | 'codex') {
  return { key: 'session_id' as const, id: `${agent}-session-1` }
}

describe('recordAgentProviderSession', () => {
  it('preserves the root session while a child permission hook moves Codex to waiting', () => {
    const store = createTestStore()
    const providerSession = { key: 'session_id' as const, id: 'root-session' }

    store
      .getState()
      .setAgentStatus(
        'tab-1:leaf-1',
        { state: 'working', prompt: 'coordinate reviewers', agentType: 'codex' },
        'Codex',
        { updatedAt: 10, stateStartedAt: 10 },
        undefined,
        { providerSession }
      )
    store.getState().setAgentStatus('tab-1:leaf-1', {
      state: 'waiting',
      prompt: 'coordinate reviewers',
      agentType: 'codex',
      subagents: [{ id: 'child-1', state: 'waiting', startedAt: 11 }]
    })

    expect(store.getState().agentStatusByPaneKey['tab-1:leaf-1']?.providerSession).toEqual(
      providerSession
    )
  })

  // Why: mobile Chat UI keys its transcript subscription on providerSession.id, so a
  // metadata-less end-of-turn `done` used to blank the chat every turn (#10630).
  it('keeps the provider session when the turn completes without session metadata', () => {
    const store = createTestStore()
    const providerSession = { key: 'session_id' as const, id: 'claude-session-1' }

    store
      .getState()
      .setAgentStatus(
        'tab-1:leaf-1',
        { state: 'working', prompt: 'summarize the diff', agentType: 'claude' },
        'Claude',
        { updatedAt: 10, stateStartedAt: 10 },
        undefined,
        { providerSession }
      )
    store.getState().setAgentStatus('tab-1:leaf-1', {
      state: 'done',
      prompt: 'summarize the diff',
      agentType: 'claude'
    })

    expect(store.getState().agentStatusByPaneKey['tab-1:leaf-1']?.providerSession).toEqual(
      providerSession
    )
  })

  // Why: `done` is the resting state, and both OSC 9999 repaints and reconnect snapshot
  // replays re-deliver a metadata-less `done` onto an already-done row. Retaining only the
  // first one still blanked the chat the moment a second landed (#10630).
  it('keeps the provider session across repeated metadata-less done pings', () => {
    const store = createTestStore()
    const providerSession = { key: 'session_id' as const, id: 'claude-session-1' }

    store
      .getState()
      .setAgentStatus(
        'tab-1:leaf-1',
        { state: 'working', prompt: 'summarize the diff', agentType: 'claude' },
        'Claude',
        { updatedAt: 10, stateStartedAt: 10 },
        undefined,
        { providerSession }
      )
    for (const prompt of ['summarize the diff', 'summarize the diff again']) {
      store
        .getState()
        .setAgentStatus('tab-1:leaf-1', { state: 'done', prompt, agentType: 'claude' })
    }

    expect(store.getState().agentStatusByPaneKey['tab-1:leaf-1']?.providerSession).toEqual(
      providerSession
    )
  })

  // Why: retention stops at the turn boundary. A metadata-less `working` after `done` starts
  // fresh work, so the finished session must not ride along into it.
  it('does not carry a completed session into the next turn', () => {
    const store = createTestStore()

    store
      .getState()
      .setAgentStatus(
        'tab-1:leaf-1',
        { state: 'working', prompt: 'first', agentType: 'claude' },
        'Claude',
        { updatedAt: 10, stateStartedAt: 10 },
        undefined,
        { providerSession: { key: 'session_id' as const, id: 'claude-session-1' } }
      )
    store
      .getState()
      .setAgentStatus('tab-1:leaf-1', { state: 'done', prompt: 'first', agentType: 'claude' })
    store
      .getState()
      .setAgentStatus('tab-1:leaf-1', { state: 'working', prompt: 'second', agentType: 'claude' })

    expect(store.getState().agentStatusByPaneKey['tab-1:leaf-1']?.providerSession).toBeUndefined()
  })

  it('keys supported provider ownership by session ID, not transcript location', () => {
    const base = {
      paneKey: 'tab-1:leaf-1',
      tabId: 'tab-1',
      worktreeId: 'wt-1',
      prompt: '',
      state: 'working' as const,
      capturedAt: 10,
      updatedAt: 10,
      origin: 'live' as const
    }
    const makeRecord = (
      agent: 'codex' | 'claude',
      transcriptPath: string
    ): SleepingAgentSessionRecord => ({
      ...base,
      agent,
      providerSession: { key: 'session_id', id: 'session-1', transcriptPath }
    })

    expect(getProviderSessionClaimKey(makeRecord('codex', '/tmp/first.jsonl'))).toBe(
      getProviderSessionClaimKey(makeRecord('codex', '/tmp/second.jsonl'))
    )
    expect(getProviderSessionClaimKey(makeRecord('claude', '/tmp/first.jsonl'))).toBe(
      getProviderSessionClaimKey(makeRecord('claude', '/tmp/second.jsonl'))
    )
    expect(getProviderSessionClaimKey(makeRecord('claude', '/tmp/first.jsonl'))).not.toBe(
      getProviderSessionClaimKey({
        ...makeRecord('claude', '/tmp/first.jsonl'),
        providerSession: { key: 'session_id', id: 'session-2' }
      })
    )
  })

  it('keeps the activity cutoff and manual-unread stamp across a heartbeat for the same pane', () => {
    const store = createTestStore()
    store.setState({
      tabsByWorktree: { 'wt-1': [makeTab({ id: 'tab-1', worktreeId: 'wt-1' })] }
    } as Partial<AppState>)
    const providerSession = {
      key: 'session_id' as const,
      id: 'codex-session-1',
      transcriptPath: '/tmp/codex-session-1.jsonl'
    }
    store
      .getState()
      .setAgentStatus(
        'tab-1:leaf-1',
        { state: 'done', prompt: 'finish', agentType: 'codex' },
        'Codex',
        { updatedAt: 10, stateStartedAt: 10 },
        { tabId: 'tab-1', worktreeId: 'wt-1' }
      )
    store.getState().applyActivityClearedAt({ 'tab-1:leaf-1': 5_000 })
    store.getState().unacknowledgeAgents(['tab-1:leaf-1'])

    store.getState().recordAgentProviderSession(
      'tab-1:leaf-1',
      'codex',
      providerSession,
      { updatedAt: 20 },
      {
        tabId: 'tab-1',
        worktreeId: 'wt-1',
        connectionId: null
      }
    )

    // The pane is not retired here — only its live status becomes a sleeping record. Dropping
    // these maps would replay history the user already cleared on the next heartbeat.
    expect(store.getState().activityClearedAtByPaneKey['tab-1:leaf-1']).toBe(5_000)
    expect(store.getState().manuallyUnreadTurnsByPaneKey['tab-1:leaf-1']).toBeGreaterThan(0)
  })

  it('preserves the legacy resume fence only for the same Codex session identity', () => {
    const store = createTestStore()
    const makeRecord = (transcriptPath: string): SleepingAgentSessionRecord => ({
      paneKey: 'tab-1:leaf-1',
      tabId: 'tab-1',
      worktreeId: 'wt-1',
      agent: 'codex',
      providerSession: {
        key: 'session_id',
        id: 'codex-session-1',
        transcriptPath
      },
      prompt: '',
      state: 'working',
      capturedAt: 10,
      updatedAt: 10,
      automaticResumeBlockedBy: 'legacy-orchestration-worker',
      origin: 'live'
    })
    store.setState({
      sleepingAgentSessionsByPaneKey: {
        'tab-1:leaf-1': makeRecord('/tmp/codex-session-1.jsonl')
      }
    } as Partial<AppState>)

    store.getState().recordAgentProviderSession(
      'tab-1:leaf-1',
      'codex',
      {
        key: 'session_id',
        id: 'codex-session-1',
        transcriptPath: '/tmp/codex-session-1.jsonl'
      },
      { updatedAt: 20 },
      { tabId: 'tab-1', worktreeId: 'wt-1' }
    )

    expect(
      store.getState().sleepingAgentSessionsByPaneKey['tab-1:leaf-1']?.automaticResumeBlockedBy
    ).toBe('legacy-orchestration-worker')

    store.getState().recordAgentProviderSession(
      'tab-1:leaf-1',
      'codex',
      {
        key: 'session_id',
        id: 'codex-session-2',
        transcriptPath: '/tmp/codex-session-2.jsonl'
      },
      { updatedAt: 30 },
      { tabId: 'tab-1', worktreeId: 'wt-1' }
    )

    expect(
      store.getState().sleepingAgentSessionsByPaneKey['tab-1:leaf-1']?.automaticResumeBlockedBy
    ).toBeUndefined()
  })

  it.each(SUPPORTED_AGENT_CASES)(
    'keeps a completed $label session resumable through manual worktree sleep',
    async ({ agent, label }) => {
      const store = createTestStore()
      store.setState({
        tabsByWorktree: {
          'wt-1': [makeTab({ id: 'tab-1', worktreeId: 'wt-1' })]
        }
      } as Partial<AppState>)
      const providerSession = makeProviderSession(agent)

      store
        .getState()
        .recordAgentProviderSession(
          'tab-1:leaf-1',
          agent,
          providerSession,
          { updatedAt: 10 },
          { tabId: 'tab-1', worktreeId: 'wt-1', connectionId: 'ssh-connection-1' }
        )
      store
        .getState()
        .setAgentStatus(
          'tab-1:leaf-1',
          { state: 'working', prompt: 'finish the task', agentType: agent },
          label,
          { updatedAt: 20, stateStartedAt: 20 },
          { tabId: 'tab-1', worktreeId: 'wt-1' },
          { providerSession }
        )
      store
        .getState()
        .setAgentStatus(
          'tab-1:leaf-1',
          { state: 'done', prompt: 'finish the task', agentType: agent },
          label,
          { updatedAt: 30, stateStartedAt: 30 },
          { tabId: 'tab-1', worktreeId: 'wt-1' },
          { providerSession }
        )

      expect(store.getState().agentStatusByPaneKey['tab-1:leaf-1']?.state).toBe('done')
      const liveRecord = store.getState().sleepingAgentSessionsByPaneKey['tab-1:leaf-1']
      expect(liveRecord).toMatchObject({
        agent,
        providerSession,
        connectionId: 'ssh-connection-1',
        state: 'done',
        origin: 'live'
      })

      store.getState().captureAllSleepingAgentSessions('periodic')
      expect(store.getState().sleepingAgentSessionsByPaneKey['tab-1:leaf-1']).toBe(liveRecord)

      await store.getState().shutdownWorktreeTerminals('wt-1', {
        keepIdentifiers: true,
        shutdownReason: 'manual-sleep',
        sleepingPaneKeys: ['tab-1:leaf-1']
      })

      expect(store.getState().agentStatusByPaneKey['tab-1:leaf-1']).toBeUndefined()
      expect(store.getState().sleepingAgentSessionsByPaneKey['tab-1:leaf-1']).toMatchObject({
        agent,
        providerSession,
        connectionId: 'ssh-connection-1',
        state: 'done',
        origin: 'worktree-sleep'
      })
    }
  )

  it('does not turn a completed recovery record back into working on a same-session update', () => {
    const store = createTestStore()
    store.setState({
      tabsByWorktree: {
        'wt-1': [makeTab({ id: 'tab-1', worktreeId: 'wt-1' })]
      }
    } as Partial<AppState>)
    const providerSession = makeProviderSession('codex')

    store
      .getState()
      .recordAgentProviderSession(
        'tab-1:leaf-1',
        'codex',
        providerSession,
        { updatedAt: 10 },
        { tabId: 'tab-1', worktreeId: 'wt-1', connectionId: 'ssh-connection-1' }
      )
    store
      .getState()
      .setAgentStatus(
        'tab-1:leaf-1',
        { state: 'working', prompt: 'finish the task', agentType: 'codex' },
        'Codex',
        { updatedAt: 20, stateStartedAt: 20 },
        { tabId: 'tab-1', worktreeId: 'wt-1' },
        { providerSession }
      )
    store
      .getState()
      .setAgentStatus(
        'tab-1:leaf-1',
        { state: 'done', prompt: 'finish the task', agentType: 'codex', interrupted: true },
        'Codex',
        { updatedAt: 30, stateStartedAt: 30 },
        { tabId: 'tab-1', worktreeId: 'wt-1' },
        { providerSession }
      )

    store
      .getState()
      .recordAgentProviderSession(
        'tab-1:leaf-1',
        'codex',
        providerSession,
        { updatedAt: 40 },
        { tabId: 'tab-1', worktreeId: 'wt-1', connectionId: 'ssh-connection-1' }
      )

    expect(store.getState().sleepingAgentSessionsByPaneKey['tab-1:leaf-1']).toMatchObject({
      providerSession,
      state: 'done',
      interrupted: true,
      origin: 'live'
    })
  })

  it('does not downgrade a quit recovery record on a same-session update', () => {
    const store = createTestStore()
    store.setState({
      tabsByWorktree: {
        'wt-1': [makeTab({ id: 'tab-1', worktreeId: 'wt-1' })]
      }
    } as Partial<AppState>)
    const providerSession = makeProviderSession('codex')

    store
      .getState()
      .recordAgentProviderSession(
        'tab-1:leaf-1',
        'codex',
        providerSession,
        { updatedAt: 10 },
        { tabId: 'tab-1', worktreeId: 'wt-1', connectionId: 'ssh-connection-1' }
      )
    store
      .getState()
      .setAgentStatus(
        'tab-1:leaf-1',
        { state: 'working', prompt: 'finish the task', agentType: 'codex' },
        'Codex',
        { updatedAt: 20, stateStartedAt: 20 },
        { tabId: 'tab-1', worktreeId: 'wt-1' },
        { providerSession }
      )
    store.getState().captureAllSleepingAgentSessions('quit')

    store
      .getState()
      .recordAgentProviderSession(
        'tab-1:leaf-1',
        'codex',
        providerSession,
        { updatedAt: 40 },
        { tabId: 'tab-1', worktreeId: 'wt-1', connectionId: 'ssh-connection-1' }
      )

    expect(store.getState().sleepingAgentSessionsByPaneKey['tab-1:leaf-1']).toMatchObject({
      providerSession,
      state: 'working',
      origin: 'quit'
    })
  })

  it.each(SUPPORTED_AGENT_CASES)(
    'preserves a completed $label record without marking it as unfinished quit recovery',
    ({ agent, label }) => {
      const store = createTestStore()
      store.setState({
        tabsByWorktree: {
          'wt-1': [makeTab({ id: 'tab-1', worktreeId: 'wt-1' })]
        }
      } as Partial<AppState>)
      const providerSession = makeProviderSession(agent)

      store
        .getState()
        .recordAgentProviderSession(
          'tab-1:leaf-1',
          agent,
          providerSession,
          { updatedAt: 10 },
          { tabId: 'tab-1', worktreeId: 'wt-1', connectionId: 'ssh-connection-1' }
        )
      store
        .getState()
        .setAgentStatus(
          'tab-1:leaf-1',
          { state: 'working', prompt: 'finish the task', agentType: agent },
          label,
          { updatedAt: 20, stateStartedAt: 20 },
          { tabId: 'tab-1', worktreeId: 'wt-1' },
          { providerSession }
        )
      store
        .getState()
        .setAgentStatus(
          'tab-1:leaf-1',
          { state: 'done', prompt: 'finish the task', agentType: agent },
          label,
          { updatedAt: 30, stateStartedAt: 30 },
          { tabId: 'tab-1', worktreeId: 'wt-1' },
          { providerSession }
        )

      store.getState().captureAllSleepingAgentSessions('periodic')
      expect(store.getState().sleepingAgentSessionsByPaneKey['tab-1:leaf-1']).toMatchObject({
        providerSession,
        connectionId: 'ssh-connection-1',
        origin: 'live'
      })

      store.getState().captureAllSleepingAgentSessions('quit')

      const quitRecord = store.getState().sleepingAgentSessionsByPaneKey['tab-1:leaf-1']
      expect(quitRecord).toMatchObject({
        agent,
        providerSession,
        connectionId: 'ssh-connection-1',
        state: 'done',
        origin: 'live'
      })

      store.getState().captureAllSleepingAgentSessions('periodic')
      expect(store.getState().sleepingAgentSessionsByPaneKey['tab-1:leaf-1']).toBe(quitRecord)
    }
  )
})
