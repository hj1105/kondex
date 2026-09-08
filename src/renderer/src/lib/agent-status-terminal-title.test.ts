import { describe, expect, it } from 'vitest'
import { resolveAgentStatusTerminalTitle } from './agent-status-terminal-title'

describe('resolveAgentStatusTerminalTitle', () => {
  it('replaces a stale late-frame Codex spinner when hook state finishes', () => {
    expect(
      resolveAgentStatusTerminalTitle({ agentType: 'codex', state: 'done' }, '\u2839 Codex')
    ).toBe('Codex ready')
  })

  it('replaces bare Codex native titles when hook state finishes', () => {
    expect(resolveAgentStatusTerminalTitle({ agentType: 'codex', state: 'done' }, 'Codex')).toBe(
      'Codex ready'
    )
  })

  it('keeps descriptive completed titles that are already non-working', () => {
    expect(
      resolveAgentStatusTerminalTitle(
        { agentType: 'codex', state: 'done' },
        'Kondex task completed'
      )
    ).toBe('Kondex task completed')
  })

  it('uses permission titles for synthetic agents waiting on user input', () => {
    expect(
      resolveAgentStatusTerminalTitle({ agentType: 'codex', state: 'blocked' }, '\u280b Codex')
    ).toBe('Codex - action required')
  })

  it('clears stale permission titles when hook state finishes', () => {
    expect(
      resolveAgentStatusTerminalTitle(
        { agentType: 'codex', state: 'done' },
        'Codex - action required'
      )
    ).toBe('Codex ready')
  })

  it('replaces stale Codex spinner titles when hook state finishes', () => {
    expect(
      resolveAgentStatusTerminalTitle({ agentType: 'codex', state: 'done' }, '\u280b Codex')
    ).toBe('Codex ready')
  })

  it('uses permission titles for Codex when hook state waits on user input', () => {
    expect(
      resolveAgentStatusTerminalTitle({ agentType: 'codex', state: 'waiting' }, '\u280b Codex')
    ).toBe('Codex - action required')
  })

  it.each(['cursor', 'devin'])(
    'does not synthesize titles for retired provider %s',
    (agentType) => {
      expect(
        resolveAgentStatusTerminalTitle({ agentType, state: 'done' }, 'Legacy native title')
      ).toBe('Legacy native title')
      expect(
        resolveAgentStatusTerminalTitle({ agentType, state: 'waiting' }, 'Legacy native title')
      ).toBe('Legacy native title')
    }
  )

  it('preserves native OpenCode titles through hook status transitions', () => {
    expect(
      resolveAgentStatusTerminalTitle(
        { agentType: 'opencode', state: 'done' },
        'OC | Native Stable Session'
      )
    ).toBe('OC | Native Stable Session')
    expect(
      resolveAgentStatusTerminalTitle(
        { agentType: 'opencode', state: 'waiting' },
        'OC | Native Stable Session'
      )
    ).toBe('OC | Native Stable Session')
  })

  it('does not invent an OpenCode title when no native title exists', () => {
    expect(
      resolveAgentStatusTerminalTitle({ agentType: 'opencode', state: 'done' }, undefined)
    ).toBeUndefined()
  })
})
