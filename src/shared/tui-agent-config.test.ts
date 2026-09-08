import { describe, expect, it } from 'vitest'
import { TUI_AGENT_CONFIG } from './tui-agent-config'

describe('TUI_AGENT_CONFIG', () => {
  it('resolves launchCmd and expectedProcess for every agent', () => {
    for (const [agent, config] of Object.entries(TUI_AGENT_CONFIG)) {
      expect(config.launchCmd, agent).toBeTruthy()
      expect(config.expectedProcess, agent).toBeTruthy()
    }
  })

  it('defaults launchCmd and expectedProcess to detectCmd', () => {
    expect(TUI_AGENT_CONFIG.codex).toMatchObject({
      detectCmd: 'codex',
      launchCmd: 'codex',
      expectedProcess: 'codex'
    })
  })

  it('only exposes the retained runtime providers', () => {
    expect(Object.keys(TUI_AGENT_CONFIG).sort()).toEqual(['claude', 'codex'])
  })
})
