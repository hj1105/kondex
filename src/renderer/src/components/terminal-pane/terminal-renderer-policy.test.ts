import { describe, expect, it } from 'vitest'
import type { AgentType } from '../../../../shared/agent-status-types'
import { resolvePaneRendererPolicy } from './terminal-renderer-policy'

const GEMINI_WORKING = '✦'

describe('resolvePaneRendererPolicy', () => {
  describe('user GPU modes', () => {
    it('keeps the content gate open under `off` for ordinary shells', () => {
      const decision = resolvePaneRendererPolicy({
        rawTitle: 'zsh',
        ownerAgentType: undefined,
        userGpuMode: 'off'
      })
      // Why: the mode gate downstream forces DOM; the gate stays open so a later
      // switch to auto/on can re-attach without waiting for a new title frame.
      expect(decision).toEqual({
        gpuEnabled: true,
        reason: 'user-setting',
        confidence: 'authoritative'
      })
    })

    it('keeps the content gate open under `off` for retired provider titles', () => {
      const decision = resolvePaneRendererPolicy({
        rawTitle: `${GEMINI_WORKING} Gemini CLI`,
        ownerAgentType: 'gemini',
        userGpuMode: 'off'
      })
      expect(decision.gpuEnabled).toBe(true)
      expect(decision.reason).toBe('user-setting')
    })

    it('keeps the content gate open under `on` for retired provider titles', () => {
      const decision = resolvePaneRendererPolicy({
        rawTitle: `${GEMINI_WORKING} Gemini CLI`,
        ownerAgentType: 'gemini',
        userGpuMode: 'on'
      })
      // Why: agent compatibility exclusions must not override an explicit on.
      expect(decision).toEqual({
        gpuEnabled: true,
        reason: 'user-setting',
        confidence: 'authoritative'
      })
    })

    it('enables GPU under `auto` for an ordinary shell', () => {
      const decision = resolvePaneRendererPolicy({
        rawTitle: 'bash',
        ownerAgentType: undefined,
        userGpuMode: 'auto'
      })
      expect(decision).toEqual({
        gpuEnabled: true,
        reason: 'capability',
        confidence: 'authoritative'
      })
    })
  })

  describe('WebGL capability and context-loss containment', () => {
    it('disables GPU under `on` when WebGL is unavailable', () => {
      const decision = resolvePaneRendererPolicy({
        rawTitle: 'bash',
        ownerAgentType: undefined,
        userGpuMode: 'on',
        webglUnavailable: true
      })
      expect(decision).toEqual({
        gpuEnabled: false,
        reason: 'capability',
        confidence: 'authoritative'
      })
    })

    it('disables GPU under `on` inside context-loss containment', () => {
      const decision = resolvePaneRendererPolicy({
        rawTitle: 'bash',
        ownerAgentType: undefined,
        userGpuMode: 'on',
        inContextLossContainment: true
      })
      expect(decision).toEqual({
        gpuEnabled: false,
        reason: 'context-loss',
        confidence: 'authoritative'
      })
    })

    it('disables GPU under `auto` inside context-loss containment', () => {
      const decision = resolvePaneRendererPolicy({
        rawTitle: 'bash',
        ownerAgentType: undefined,
        userGpuMode: 'auto',
        inContextLossContainment: true
      })
      expect(decision.gpuEnabled).toBe(false)
      expect(decision.reason).toBe('context-loss')
    })
  })

  describe('retired provider titles under `auto`', () => {
    it('does not restore the Gemini fallback without an authoritative owner', () => {
      const decision = resolvePaneRendererPolicy({
        rawTitle: `${GEMINI_WORKING} Gemini CLI`,
        ownerAgentType: undefined,
        userGpuMode: 'auto'
      })
      expect(decision).toEqual({
        gpuEnabled: true,
        reason: 'capability',
        confidence: 'authoritative'
      })
    })

    it('does not restore the Gemini fallback from legacy owner metadata', () => {
      const decision = resolvePaneRendererPolicy({
        rawTitle: `${GEMINI_WORKING} Gemini CLI`,
        ownerAgentType: 'gemini',
        userGpuMode: 'auto'
      })
      expect(decision).toEqual({
        gpuEnabled: true,
        reason: 'capability',
        confidence: 'authoritative'
      })
    })

    it('keeps GPU on when a Codex owner emits a Gemini-looking title', () => {
      const decision = resolvePaneRendererPolicy({
        rawTitle: `${GEMINI_WORKING} Gemini CLI`,
        ownerAgentType: 'codex',
        userGpuMode: 'auto'
      })
      expect(decision.gpuEnabled).toBe(true)
      expect(decision.reason).toBe('capability')
    })

    it('does not restore the Gemini fallback for an unknown owner', () => {
      const decision = resolvePaneRendererPolicy({
        rawTitle: `${GEMINI_WORKING} Gemini CLI`,
        ownerAgentType: 'unknown',
        userGpuMode: 'auto'
      })
      expect(decision.gpuEnabled).toBe(true)
      expect(decision.reason).toBe('capability')
    })
  })

  describe('agent token text cannot flip renderer policy under authoritative owners', () => {
    const AGENT_TOKENS = ['gemini', 'claude', 'codex', 'opencode', 'cursor', 'omp', 'pi'] as const

    for (const token of AGENT_TOKENS) {
      it(`keeps GPU on when a title mentions "${token}" but owner is another agent`, () => {
        const ownerAgentType: AgentType = token === 'claude' ? 'codex' : 'claude'
        const decision = resolvePaneRendererPolicy({
          rawTitle: token,
          ownerAgentType,
          userGpuMode: 'auto'
        })
        expect(decision.gpuEnabled).toBe(true)
      })
    }

    it('keeps GPU on for an OMP owner whose title is exactly the Gemini token', () => {
      const decision = resolvePaneRendererPolicy({
        rawTitle: 'gemini',
        ownerAgentType: 'omp',
        userGpuMode: 'auto'
      })
      expect(decision.gpuEnabled).toBe(true)
    })

    it('keeps GPU on for a Pi owner whose title is exactly the Gemini token', () => {
      const decision = resolvePaneRendererPolicy({
        rawTitle: 'gemini',
        ownerAgentType: 'pi',
        userGpuMode: 'auto'
      })
      expect(decision.gpuEnabled).toBe(true)
    })
  })
})
