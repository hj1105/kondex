import { describe, expect, it } from 'vitest'
import { getAgentLabel } from './agent-title-identity'

// Preserve legacy Codex/Claude answers while rejecting labels removed from the catalog.
const ownerSuffix = (task: string, agent: string): string => `${task}… - ${agent}`

describe('getAgentLabel — retained-provider characterization', () => {
  describe('legacy title matching is not authoritative pane ownership', () => {
    it.each([
      ['Switch Claude and Codex off the load balancer', 'Codex'],
      ['Codex structured chat revalidation', 'Codex'],
      ['Swap Codex off the load balancer', 'Codex']
    ])('retains the supported mention in %j as %s', (task, current) => {
      expect(getAgentLabel(ownerSuffix(task, 'grok'))).toBe(current)
    })

    it('reads a spinner-prefixed Grok pane as Codex', () => {
      expect(getAgentLabel(`⠸ - Thinking - ${ownerSuffix('Codex native-chat work', 'grok')}`)).toBe(
        'Codex'
      )
    })

    it('rejects a retired owner and its two retired competitors', () => {
      expect(
        getAgentLabel(ownerSuffix('Electron QA: Antigravity tab vs Gemini label', 'grok'))
      ).toBeNull()
    })

    it('rejects a retired owner and a Gemini mention', () => {
      expect(getAgentLabel(ownerSuffix('Electron QA: check the Gemini label', 'grok'))).toBeNull()
    })

    it('does not recognize a retired owner suffix on ordinary task text', () => {
      expect(getAgentLabel(ownerSuffix('Fix the sidebar row', 'grok'))).toBeNull()
    })
  })

  describe('a hyphenated worktree name is correctly not identity', () => {
    it.each(['review-14600-codex', 'sta4779-review-codex', 'codex-split-core'])(
      'declines %j',
      (title) => {
        expect(getAgentLabel(title)).toBeNull()
      }
    )
  })

  describe('title order does not decide between two names', () => {
    it.each([
      ['codex', 'grok', 'Codex'],
      ['grok', 'codex', 'Codex'],
      ['gemini', 'antigravity', null],
      ['antigravity', 'gemini', null],
      ['copilot', 'devin', null],
      ['devin', 'copilot', null]
    ])('%s + %s resolves to the retained label %s', (first, second, winner) => {
      expect(getAgentLabel(`${first} and ${second}`)).toBe(winner)
    })
  })

  describe('a vendor glyph is claimed by whichever check sits earliest', () => {
    it('claims a Claude glyph even when the task text names another agent', () => {
      expect(getAgentLabel('✳ Fix Codex false attention notifications on Windows')).toBe(
        'Claude Code'
      )
    })

    it('gives a bare agent name no way to outrank an earlier glyph check', () => {
      expect(getAgentLabel('✳ agy')).toBe('Claude Code')
    })
  })

  describe('Antigravity model names', () => {
    it('rejects a bare retired model title', () => {
      expect(getAgentLabel('Gemini 3.7 Flash · high')).toBeNull()
    })

    it('rejects retired vendor and model names together', () => {
      expect(getAgentLabel('agy · Gemini 3.7 Flash')).toBeNull()
    })
  })
})
