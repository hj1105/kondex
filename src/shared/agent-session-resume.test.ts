import { describe, expect, it } from 'vitest'
import {
  agentProviderSessionsEqual,
  extractAgentProviderSession,
  getAgentResumeArgv,
  isResumableTuiAgent,
  normalizeAgentProviderSession
} from './agent-session-resume'

describe('agent session resume metadata', () => {
  it('limits resumable agents to Codex and Claude', () => {
    expect(isResumableTuiAgent('claude')).toBe(true)
    expect(isResumableTuiAgent('codex')).toBe(true)
    expect(isResumableTuiAgent('prime-agent')).toBe(false)
  })

  it.each([
    ['claude', { session_id: 'claude-session' }, { key: 'session_id', id: 'claude-session' }],
    ['codex', { session_id: 'codex-session' }, { key: 'session_id', id: 'codex-session' }]
  ] as const)('extracts %s provider session ids', (source, payload, expected) => {
    expect(extractAgentProviderSession(source, payload)).toEqual(expected)
  })

  it.each([
    ['claude', { key: 'session_id', id: 's1' }, ['claude', '--resume', 's1']],
    ['codex', { key: 'session_id', id: 's1' }, ['codex', 'resume', 's1']]
  ] as const)('builds %s resume argv', (agent, providerSession, expected) => {
    expect(getAgentResumeArgv(agent, providerSession)).toEqual(expected)
  })

  it('rejects unsupported sources and unsafe ids', () => {
    // @ts-expect-error Exercise untrusted input from an older runtime.
    expect(extractAgentProviderSession('cursor', { session_id: 'cursor-session' })).toBeNull()
    expect(normalizeAgentProviderSession({ key: 'session_id', id: 'bad\nid' })).toBeNull()
    expect(normalizeAgentProviderSession({ key: 'session_id', id: '--last' })).toBeNull()
    expect(extractAgentProviderSession('codex', { session_id: '--last' })).toBeNull()
    expect(normalizeAgentProviderSession({ key: 'session_id', id: 'ok' })).toEqual({
      key: 'session_id',
      id: 'ok'
    })
  })

  it('compares the actual provider resume locator for each agent', () => {
    const first = { key: 'session_id' as const, id: 'session-1', transcriptPath: '/tmp/first' }
    const second = { key: 'session_id' as const, id: 'session-1', transcriptPath: '/tmp/second' }

    expect(agentProviderSessionsEqual('codex', first, second)).toBe(true)
    expect(agentProviderSessionsEqual('claude', first, second)).toBe(true)
  })

  it('rejects a resume when the provider session key is not session_id', () => {
    expect(getAgentResumeArgv('codex', { key: 'conversation_id', id: 'x' })).toBeNull()
  })

  it('captures the hook transcript_path for native-chat agents (claude/codex)', () => {
    expect(
      extractAgentProviderSession('claude', {
        session_id: 'cs',
        transcript_path: '/home/u/.claude/projects/slug/real.jsonl'
      })
    ).toEqual({
      key: 'session_id',
      id: 'cs',
      transcriptPath: '/home/u/.claude/projects/slug/real.jsonl'
    })
    expect(
      extractAgentProviderSession('codex', { session_id: 'xs', transcriptPath: '/x/r.jsonl' })
    ).toEqual({ key: 'session_id', id: 'xs', transcriptPath: '/x/r.jsonl' })
  })

  it('round-trips transcriptPath through normalizeAgentProviderSession', () => {
    expect(
      normalizeAgentProviderSession({ key: 'session_id', id: 'ok', transcriptPath: '/x/r.jsonl' })
    ).toEqual({ key: 'session_id', id: 'ok', transcriptPath: '/x/r.jsonl' })
    expect(
      normalizeAgentProviderSession({
        key: 'session_id',
        id: 'ok',
        transcriptPath: '/tmp/bad\npath.jsonl'
      })
    ).toEqual({ key: 'session_id', id: 'ok' })
  })
})
