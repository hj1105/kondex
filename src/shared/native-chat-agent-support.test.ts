import { describe, expect, it } from 'vitest'
import {
  NATIVE_CHAT_SUPPORTED_AGENT_LIST,
  NATIVE_CHAT_SUPPORTED_AGENTS,
  isNativeChatSupportedAgent,
  nativeChatRequiresLocalTranscript,
  resolveNativeChatTranscriptAgent,
  shouldStepNativeChatAskAnswer
} from './native-chat-agent-support'

describe('resolveNativeChatTranscriptAgent', () => {
  it('preserves Claude and Codex transcript identities', () => {
    expect(resolveNativeChatTranscriptAgent('claude')).toBe('claude')
    expect(resolveNativeChatTranscriptAgent('codex')).toBe('codex')
  })

  it.each(['openclaude', 'grok', 'omp', 'cursor', 'unknown', '', null, undefined])(
    'does not admit unsupported transcript provider %s',
    (agent) => {
      expect(resolveNativeChatTranscriptAgent(agent)).toBeNull()
      expect(isNativeChatSupportedAgent(agent)).toBe(false)
      expect(shouldStepNativeChatAskAnswer(agent)).toBe(false)
    }
  )

  it('advertises exactly the supported transcript providers', () => {
    expect(NATIVE_CHAT_SUPPORTED_AGENT_LIST).toEqual(['claude', 'codex'])
    expect([...NATIVE_CHAT_SUPPORTED_AGENTS]).toEqual(['claude', 'codex'])
  })
})

describe('isNativeChatSupportedAgent', () => {
  it('recognizes the parseable agents and rejects unknown / nullish input', () => {
    expect(isNativeChatSupportedAgent('claude')).toBe(true)
    expect(isNativeChatSupportedAgent('codex')).toBe(true)
    expect(isNativeChatSupportedAgent('openclaude')).toBe(false)
    expect(isNativeChatSupportedAgent('omp')).toBe(false)
    expect(isNativeChatSupportedAgent('cursor')).toBe(false)
    expect(isNativeChatSupportedAgent(null)).toBe(false)
    expect(isNativeChatSupportedAgent(undefined)).toBe(false)
  })
})

describe('nativeChatRequiresLocalTranscript', () => {
  it('does not require a local-only transcript scanner for retained providers', () => {
    expect(nativeChatRequiresLocalTranscript('grok')).toBe(false)
    expect(nativeChatRequiresLocalTranscript('omp')).toBe(false)
    expect(nativeChatRequiresLocalTranscript('claude')).toBe(false)
    expect(nativeChatRequiresLocalTranscript('openclaude')).toBe(false)
    expect(nativeChatRequiresLocalTranscript('codex')).toBe(false)
    expect(nativeChatRequiresLocalTranscript('cursor')).toBe(false)
    expect(nativeChatRequiresLocalTranscript(null)).toBe(false)
    expect(nativeChatRequiresLocalTranscript(undefined)).toBe(false)
  })
})

describe('shouldStepNativeChatAskAnswer', () => {
  it('steps the digit-commit selector agents (Claude and Codex)', () => {
    expect(shouldStepNativeChatAskAnswer('claude')).toBe(true)
    expect(shouldStepNativeChatAskAnswer('openclaude')).toBe(false)
    // Codex 0.145's request_user_input card ignores typed labels and commits on
    // the highlighted row, so pasted answers misdeliver like STA-1860.
    expect(shouldStepNativeChatAskAnswer('codex')).toBe(true)
  })

  it('does not step other or unknown agents', () => {
    expect(shouldStepNativeChatAskAnswer('grok')).toBe(false)
    expect(shouldStepNativeChatAskAnswer('omp')).toBe(false)
    expect(shouldStepNativeChatAskAnswer('cursor')).toBe(false)
    expect(shouldStepNativeChatAskAnswer(null)).toBe(false)
    expect(shouldStepNativeChatAskAnswer(undefined)).toBe(false)
  })
})
