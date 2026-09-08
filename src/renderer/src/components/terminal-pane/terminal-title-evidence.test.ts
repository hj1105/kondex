import { describe, expect, it } from 'vitest'
import { resolvePaneDisplayTitle, resolvePaneTitleDecision } from './terminal-title-evidence'

describe('resolvePaneDisplayTitle', () => {
  it('does not revive Pi/OMP title aliases from legacy owner metadata', () => {
    expect(resolvePaneDisplayTitle('Pi ready', 'omp')).toBe('Pi ready')
  })

  it('passes an unowned title through unchanged', () => {
    expect(resolvePaneDisplayTitle('bash', undefined)).toBe('bash')
  })

  it('does not revive Pi/OMP title aliases from legacy launch metadata', () => {
    expect(resolvePaneDisplayTitle('\u280b OMP', 'pi', true)).toBe('\u280b OMP')
  })

  it('does not let a different launch owner rewrite an observed Codex title', () => {
    expect(resolvePaneDisplayTitle('Codex working', 'claude', true)).toBe('Codex working')
  })
})

describe('resolvePaneTitleDecision', () => {
  it('preserves normalized and raw titles as separate evidence', () => {
    const decision = resolvePaneTitleDecision({
      normalizedTitle: 'Codex working',
      rawTitle: '✦ Gemini CLI',
      displayOwnerAgentType: 'codex',
      rendererOwnerAgentType: 'codex',
      userGpuMode: 'auto'
    })
    expect(decision.displayTitle).toBe('Codex working')
    expect(decision.rawTitle).toBe('✦ Gemini CLI')
    expect(decision.rendererPolicy.gpuEnabled).toBe(true)
  })

  it('does not restore a title-based GPU veto when pane ownership is missing', () => {
    const decision = resolvePaneTitleDecision({
      normalizedTitle: 'Claude working',
      rawTitle: '✦ Gemini CLI',
      displayOwnerAgentType: 'claude',
      rendererOwnerAgentType: undefined,
      userGpuMode: 'auto'
    })
    expect(decision.displayTitle).toBe('Claude working')
    expect(decision.rendererPolicy.gpuEnabled).toBe(true)
    expect(decision.rendererPolicy.reason).toBe('capability')
  })

  it('preserves a retired provider title without its old GPU exception', () => {
    const decision = resolvePaneTitleDecision({
      normalizedTitle: '✦ Gemini CLI',
      rawTitle: '✦ Gemini CLI',
      displayOwnerAgentType: 'gemini',
      rendererOwnerAgentType: 'gemini',
      userGpuMode: 'auto'
    })
    expect(decision.rawTitle).toBe('✦ Gemini CLI')
    expect(decision.displayTitle).toBe('✦ Gemini CLI')
    expect(decision.rendererPolicy.gpuEnabled).toBe(true)
    expect(decision.rendererPolicy.reason).toBe('capability')
  })

  it.each([
    ['webglUnavailable', 'capability'],
    ['inContextLossContainment', 'context-loss']
  ] as const)('forwards %s even with an explicit GPU-on preference', (latch, reason) => {
    const decision = resolvePaneTitleDecision({
      normalizedTitle: 'Codex working',
      rawTitle: '✦ Gemini CLI',
      displayOwnerAgentType: 'codex',
      rendererOwnerAgentType: 'codex',
      userGpuMode: 'on',
      [latch]: true
    })
    expect(decision.displayTitle).toBe('Codex working')
    expect(decision.rawTitle).toBe('✦ Gemini CLI')
    expect(decision.rendererPolicy).toEqual({
      gpuEnabled: false,
      reason,
      confidence: 'authoritative'
    })
  })
})
