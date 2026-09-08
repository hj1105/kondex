import { describe, expect, it } from 'vitest'

import { collectAgentTitleEvidence } from './agent-title-evidence'

const agentFor = (title: string) => collectAgentTitleEvidence(title).agent
const reasonFor = (title: string) => collectAgentTitleEvidence(title).reason

describe('collectAgentTitleEvidence', () => {
  it('terminates when a wrapper separator starts at position zero', () => {
    expect(agentFor(' | codex')).toBe('codex')
    expect(agentFor(' |  | codex')).toBe('codex')
    expect(agentFor(' | ')).toBeNull()
  })

  describe('an anchored name outranks a name in task text', () => {
    // Minimized from real recorded titles that resolve to the wrong agent on the ordered chain:
    // the pane owner is named by Orca's `- <agent>` suffix, the competitor only by task text.
    it.each([
      'Switch Claude and Codex off the load balancer… - codex',
      'Codex structured chat revalidation… - codex',
      '⠸ - Thinking - Codex native-chat work… - codex',
      'Electron QA: check the Gemini label… - codex'
    ])('resolves %j to the suffix owner', (title) => {
      expect(agentFor(title)).toBe('codex')
    })

    it('does not read a hyphenated worktree name as an owner suffix', () => {
      // `review-14600-codex` is a directory, not an owner declaration. The suffix grammar
      // requires whitespace before the dash precisely to keep these apart.
      expect(agentFor('review-14600-codex')).toBeNull()
      expect(agentFor('codex-split-core')).toBeNull()
    })

    it.each(['claude', 'codex'] as const)('recognizes the reserved owner id %s', (agent) => {
      expect(agentFor(`Review another agent… - ${agent}`)).toBe(agent)
    })
  })

  describe('order independence', () => {
    // The defect this replaces is that chain position decides between two names. Swapping the
    // two names in a title must not change the answer.
    it.each([
      ['claude', 'codex'],
      ['codex', 'claude']
    ] as const)('gives %s + %s the same answer in both orders', (a, b) => {
      const forward = collectAgentTitleEvidence(`${a} and ${b}`)
      const reverse = collectAgentTitleEvidence(`${b} and ${a}`)
      expect(forward.agent).toBe(reverse.agent)
      expect(forward.agent).toBeNull()
      expect([...forward.freeTextNames].sort()).toEqual([a, b].sort())
      expect([...reverse.freeTextNames].sort()).toEqual([a, b].sort())
    })
  })

  it.each([
    ['claude', 'claude'],
    ['codex', 'codex']
  ] as const)('collects the free-text token %s without claiming identity', (token, agent) => {
    expect(collectAgentTitleEvidence(`review the ${token} integration`)).toMatchObject({
      agent: null,
      reason: 'free-text-only',
      freeTextNames: [agent]
    })
  })

  describe('a vendor marker is evidence the agent emitted, not text a human typed', () => {
    it('keeps a Claude pane Claude when its task text names another agent', () => {
      // 13 recorded titles have this shape. The sigil is emitted by Claude; the name is typed.
      expect(agentFor('✳ Fix Codex false attention notifications on Windows')).toBe('claude')
      expect(reasonFor('✳ Consolidate Codex subagent sidebar rows')).toBe('vendor-marker')
    })

    it('lets an anchored name outrank a foreign vendor marker', () => {
      expect(agentFor('✳ agy')).toBe('claude')
      expect(reasonFor('✳ agy')).toBe('vendor-marker')
      expect(agentFor('✳ codex')).toBe('codex')
      expect(reasonFor('✳ codex')).toBe('anchored')
    })
  })

  describe('a name in free text alone is never identity', () => {
    it.each([
      '◐ DaemonConnectionLostError with 70 Codex agents',
      'Fix the claude hook',
      'Debug the codex sidecar'
    ] as const)('declines %j', (title) => {
      expect(agentFor(title)).toBeNull()
      expect(reasonFor(title)).toBe('free-text-only')
    })
  })

  it.each([
    ['Claude Code', 'claude'],
    ['Codex', 'codex']
  ] as const)('recognizes the emitted whole-title alias %s', (title, agent) => {
    expect(agentFor(title)).toBe(agent)
    expect(reasonFor(title)).toBe('anchored')
  })

  it.each(['Continue', 'Charm', 'Goose', 'Amp'])(
    'does not treat the UI-only display label %s as identity',
    (title) => {
      expect(agentFor(title)).toBeNull()
      expect(reasonFor(title)).toBe('no-evidence')
    }
  )

  it.each([
    '~/codex',
    '~/claude',
    '/claude',
    '.\\claude',
    'C:\\codex',
    'C:/codex',
    '~/Codex ready',
    '.\\Cursor ready'
  ])('does not treat the cwd path %s as identity', (title) => {
    expect(agentFor(title)).toBeNull()
  })

  it('does not duplicate an anchored token as free text', () => {
    expect(collectAgentTitleEvidence('codex.exe').freeTextNames).toEqual([])
    expect(collectAgentTitleEvidence('Claude Code').freeTextNames).toEqual([])
  })

  it.each([
    ['Codex ready', 'codex'],
    ['Codex - action required', 'codex']
  ] as const)('recognizes Orca-controlled synthetic title %s', (title, agent) => {
    expect(agentFor(title)).toBe(agent)
    expect(reasonFor(title)).toBe('anchored')
  })

  it.each(['Droid', 'Hermes', 'Devin'])(
    'does not treat a bare working label as synthetic identity: %s',
    (title) => {
      expect(agentFor(title)).toBeNull()
      expect(reasonFor(title)).toBe('no-evidence')
    }
  )

  it.each([
    'Claude Code ready',
    'Claude thinking',
    '. Claude Code working',
    'zsh | ⠋ Claude Code - action required'
  ])('recognizes the explicit Claude identity frame %s', (title) => {
    expect(agentFor(title)).toBe('claude')
    expect(reasonFor(title)).toBe('anchored')
  })

  it('does not promote Claude status words in task text', () => {
    expect(agentFor('Fix the Claude Code ready-state parser')).toBeNull()
    expect(agentFor('Fix Claude Code ready behavior… - codex')).toBe('codex')
  })

  it.each(['. Review the parser', '* Waiting for input'])(
    'recognizes the established Claude status prefix in %s',
    (title) => {
      expect(agentFor(title)).toBe('claude')
      expect(reasonFor(title)).toBe('vendor-marker')
    }
  )

  it.each([
    ['⠋ Claude Code working', 'claude'],
    ['⠋ Codex ready', 'codex']
  ] as const)('recognizes the decorated identity frame %s', (title, agent) => {
    expect(agentFor(title)).toBe(agent)
    expect(reasonFor(title)).toBe('anchored')
  })

  it('does not invent synthetic titles for an opted-out profile', () => {
    expect(agentFor('OpenCode ready')).toBeNull()
    expect(agentFor('⠋ OpenCode')).toBeNull()
    expect(reasonFor('OpenCode ready')).toBe('no-evidence')
  })

  it('reads identity from the innermost wrapper segment', () => {
    expect(agentFor('zsh | ⠋ Claude Code')).toBe('claude')
    expect(agentFor('ssh | tmux | Claude Code')).toBe('claude')
    expect(agentFor('ssh | tmux | Codex ready')).toBe('codex')
    expect(agentFor('zsh | Fix the Codex parser')).toBeNull()
  })

  it('bounds wrapper inspection while preserving innermost identity', () => {
    const wrappers = Array.from({ length: 200 }, (_, index) => `wrapper-${index}`).join(' | ')
    expect(agentFor(`${wrappers} | ⠋ Claude Code`)).toBe('claude')
    expect(agentFor(`${wrappers} | Codex ready`)).toBe('codex')
    expect(agentFor(`outer-a | outer-b | retired-wrapper | ${wrappers} | Claude Code`)).toBe(
      'claude'
    )
  })

  it.each([
    ['codex.exe', 'codex'],
    ['claude.cmd', 'claude'],
    ['claude.ps1', 'claude'],
    ['CODEX.EXE', 'codex']
  ] as const)('recognizes the bare Windows launcher %s', (title, agent) => {
    expect(agentFor(title)).toBe(agent)
    expect(reasonFor(title)).toBe('anchored')
  })

  it('produces no name evidence for an agent outside the token set', () => {
    // The token set is deliberately narrower than the agent union: short names like `omp` would
    // classify ordinary shell text. Such a title yields no evidence at all rather than a guess.
    expect(reasonFor('Review PR for OMP transcript rendering')).toBe('no-evidence')
  })

  describe('activity is not identity', () => {
    it.each(['◐ Rebase PR #14624 onto main', '⠂ Fix SSH fallback', '⠋ Thinking'])(
      'declines the spinner-only title %j',
      (title) => {
        // Braille and quarter-circle spinners are emitted by many agents, so they prove the pane
        // is busy and nothing about who it is. Callers that want busy-ness use activity parsing.
        expect(agentFor(title)).toBeNull()
        expect(reasonFor(title)).toBe('no-evidence')
      }
    )
  })

  it('does not treat an embedded Claude sigil as a vendor marker', () => {
    expect(collectAgentTitleEvidence('task text ✳ decoration')).toEqual({
      vendorMarkers: [],
      anchoredNames: [],
      freeTextNames: [],
      agent: null,
      reason: 'no-evidence'
    })
  })

  it('recognizes a bare Claude sigil as a vendor marker', () => {
    expect(collectAgentTitleEvidence('✳')).toEqual({
      vendorMarkers: ['claude'],
      anchoredNames: [],
      freeTextNames: [],
      agent: 'claude',
      reason: 'vendor-marker'
    })
  })

  describe('conflicting evidence of the same class resolves to nothing', () => {
    it('does not count an unsupported vendor marker', () => {
      const evidence = collectAgentTitleEvidence('✳ | ✦ two sigils')
      expect(evidence.agent).toBe('claude')
      expect(evidence.reason).toBe('vendor-marker')
      expect(evidence.vendorMarkers).toEqual(['claude'])
    })
  })

  it('declines a Claude management screen', () => {
    expect(collectAgentTitleEvidence('claude agents')).toEqual({
      vendorMarkers: [],
      anchoredNames: [],
      freeTextNames: [],
      agent: null,
      reason: 'no-evidence'
    })
  })

  it('requires whitespace before the owner suffix dash', () => {
    expect(agentFor('task- codex')).toBeNull()
    expect(reasonFor('task- codex')).toBe('free-text-only')
  })

  it('terminates when a wrapper title starts with a separator', () => {
    expect(agentFor(' | ')).toBeNull()
  })
})
