import { describe, expect, it } from 'vitest'
import {
  getSyntheticAgentTerminalTitle,
  shouldDriveSyntheticAgentTitleFromHook
} from './synthetic-agent-title'

describe('synthetic agent titles', () => {
  it('provides terminal-state titles for Codex hook completion', () => {
    expect(getSyntheticAgentTerminalTitle('codex', 'done')).toBe('Codex ready')
    expect(getSyntheticAgentTerminalTitle('codex', 'waiting')).toBe('Codex - action required')
  })

  it('does not synthesize Codex working titles over Codex native spinner titles', () => {
    expect(shouldDriveSyntheticAgentTitleFromHook('codex', 'working')).toBe(false)
    expect(shouldDriveSyntheticAgentTitleFromHook('codex', 'done')).toBe(true)
  })

  it('does not synthesize OpenCode titles over native session titles', () => {
    expect(getSyntheticAgentTerminalTitle('opencode', 'done')).toBeNull()
    expect(getSyntheticAgentTerminalTitle('opencode', 'waiting')).toBeNull()
    expect(shouldDriveSyntheticAgentTitleFromHook('opencode', 'working')).toBe(false)
    expect(shouldDriveSyntheticAgentTitleFromHook('opencode', 'done')).toBe(false)
    expect(shouldDriveSyntheticAgentTitleFromHook('opencode', 'waiting')).toBe(false)
  })

  it.each(['devin', 'omp', 'pi', 'claude'])(
    'does not synthesize hook-driven titles for %s',
    (agent) => {
      for (const state of ['working', 'done', 'waiting', 'blocked'] as const) {
        expect(getSyntheticAgentTerminalTitle(agent, state)).toBeNull()
        expect(shouldDriveSyntheticAgentTitleFromHook(agent, state)).toBe(false)
      }
    }
  )
})
