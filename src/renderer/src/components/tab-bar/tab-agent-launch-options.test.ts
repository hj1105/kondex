import { describe, expect, it } from 'vitest'
import {
  buildTabAgentLaunchOptions,
  findMatchingTabAgentLaunchOptions,
  orderTabLaunchAgents
} from './tab-agent-launch-options'

describe('tab agent launch options', () => {
  it('orders detected agents by the configured default first', () => {
    expect(orderTabLaunchAgents('codex', ['claude', 'codex'])).toEqual(['codex', 'claude'])
  })

  it('excludes disabled agents from the launch list', () => {
    expect(orderTabLaunchAgents(null, ['claude', 'codex'], ['codex'])).toEqual(['claude'])
  })

  it('drops a disabled default agent instead of surfacing it first', () => {
    const ordered = orderTabLaunchAgents('codex', ['claude', 'codex'], ['codex'])
    expect(ordered).not.toContain('codex')
    expect(ordered).toEqual(['claude'])
  })

  it('keeps a disabled agent out of new-tab search results', () => {
    const options = buildTabAgentLaunchOptions(
      orderTabLaunchAgents('codex', ['claude', 'codex'], ['claude'])
    )
    expect(findMatchingTabAgentLaunchOptions('clau', options).map((o) => o.agent)).toEqual([])
  })

  it('matches detected agents by id, label, command, and command override', () => {
    const options = buildTabAgentLaunchOptions(['claude', 'codex'], {
      codex: 'codex-beta'
    })

    expect(
      findMatchingTabAgentLaunchOptions('Claude', options).map((option) => option.agent)
    ).toEqual(['claude'])
    expect(findMatchingTabAgentLaunchOptions('openai codex', options)).toEqual([])
    expect(
      findMatchingTabAgentLaunchOptions('codex-beta', options).map((option) => option.agent)
    ).toEqual(['codex'])
  })

  it('matches agents on a partial prefix so the launcher actually searches', () => {
    const options = buildTabAgentLaunchOptions(['claude', 'codex'])

    // Each is one character short of the full agent name.
    expect(findMatchingTabAgentLaunchOptions('code', options).map((o) => o.agent)).toEqual([
      'codex'
    ])
    expect(findMatchingTabAgentLaunchOptions('clau', options).map((o) => o.agent)).toEqual([
      'claude'
    ])
  })

  it('ranks an exact alias above weaker prefix matches', () => {
    const options = buildTabAgentLaunchOptions(['claude', 'codex'], { claude: 'codex-wrapper' })

    // The override also starts with "codex"; the exact agent name must lead.
    expect(findMatchingTabAgentLaunchOptions('codex', options)[0]?.agent).toBe('codex')
    expect(findMatchingTabAgentLaunchOptions('co', options).map((o) => o.agent)).toEqual(
      expect.arrayContaining(['codex', 'claude'])
    )
  })

  it('does not match on a mid-string substring that would hijack file results', () => {
    const options = buildTabAgentLaunchOptions(['codex', 'claude'])

    // "ode" is inside "codex" but not a prefix — agents rank above files, so
    // a noisy mid-string hit must not surface.
    expect(findMatchingTabAgentLaunchOptions('ode', options)).toEqual([])
  })

  it('requires at least two characters before a prefix matches (no single-key flood)', () => {
    const options = buildTabAgentLaunchOptions(['claude', 'codex'])

    // A lone "c" must not surface (and auto-launch) an agent.
    expect(findMatchingTabAgentLaunchOptions('c', options)).toEqual([])
    // Two characters is enough to start searching.
    expect(findMatchingTabAgentLaunchOptions('co', options).map((o) => o.agent)).toEqual(['codex'])
  })
})
