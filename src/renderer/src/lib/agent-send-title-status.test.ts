import { describe, expect, it } from 'vitest'
import { detectAgentSendTitleStatus } from './agent-send-title-status'

describe('detectAgentSendTitleStatus', () => {
  it.each([
    'OC | Native session',
    'OC | ✦ Gemini CLI',
    'OC | ✋ review Gemini permission handling',
    'ssh build-host | OC | Native session',
    'user@host: ~/code | OC | Native session',
    '▣ OC | Native session',
    'OC |   Native session',
    'OC |\tNative session'
  ])('does not admit a retired-provider title %j as a send-ready signal', (title) => {
    expect(detectAgentSendTitleStatus(title)).toBeNull()
  })

  it('preserves generic spinner activity without treating it as send-ready', () => {
    expect(detectAgentSendTitleStatus('⠋ OC | Native session')).toBe('working')
    expect(detectAgentSendTitleStatus('ssh build-host | ⠋ OC | Native session')).toBe('working')
  })

  it.each(['OC |', 'OC |Native session', 'oc | Native session', 'OCTOPUS | Native session'])(
    'rejects incomplete or lookalike OpenCode title %j',
    (title) => {
      expect(detectAgentSendTitleStatus(title)).toBeNull()
    }
  )

  it('does not infer activity from a retired provider glyph', () => {
    expect(detectAgentSendTitleStatus('✦ Gemini CLI')).toBeNull()
  })

  it('requires explicit readiness from supported providers', () => {
    expect(detectAgentSendTitleStatus('Codex ready')).toBe('idle')
    expect(detectAgentSendTitleStatus('Claude ready')).toBe('idle')
    expect(detectAgentSendTitleStatus('✳ Review changes')).toBe('idle')
    expect(detectAgentSendTitleStatus('Codex')).toBeNull()
    expect(detectAgentSendTitleStatus('Claude')).toBeNull()
    expect(detectAgentSendTitleStatus('Codex readying')).toBeNull()
    expect(detectAgentSendTitleStatus('zsh')).toBeNull()
  })

  it.each(['', null, undefined])('rejects missing title %j', (title) => {
    expect(detectAgentSendTitleStatus(title)).toBeNull()
  })
})
