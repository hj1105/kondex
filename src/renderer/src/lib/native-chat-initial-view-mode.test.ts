import { describe, it, expect } from 'vitest'

import {
  decideInitialAgentTabViewMode,
  initialAgentTabViewModeProps
} from './native-chat-initial-view-mode'

describe('decideInitialAgentTabViewMode', () => {
  it("returns 'chat' when native chat and the opt-in default setting are on", () => {
    expect(
      decideInitialAgentTabViewMode({
        experimentalNativeChat: true,
        openAgentTabsInChatByDefault: true,
        agent: 'codex'
      })
    ).toBe('chat')
  })

  it('returns undefined when native chat is disabled', () => {
    expect(
      decideInitialAgentTabViewMode({
        experimentalNativeChat: false,
        openAgentTabsInChatByDefault: true,
        agent: 'codex'
      })
    ).toBeUndefined()
  })

  it('returns undefined when the default-chat setting is off', () => {
    expect(
      decideInitialAgentTabViewMode({
        experimentalNativeChat: true,
        openAgentTabsInChatByDefault: false,
        agent: 'codex'
      })
    ).toBeUndefined()
  })

  it('returns undefined when the setting is missing (legacy settings)', () => {
    expect(
      decideInitialAgentTabViewMode({
        experimentalNativeChat: true,
        openAgentTabsInChatByDefault: undefined,
        agent: 'codex'
      })
    ).toBeUndefined()
  })

  it.each(['gemini', 'opencode'] as const)(
    'keeps unsupported agent %s in terminal view',
    (agent) => {
      expect(
        decideInitialAgentTabViewMode({
          experimentalNativeChat: true,
          openAgentTabsInChatByDefault: true,
          // @ts-expect-error Persisted unsupported values must stay in terminal view.
          agent
        })
      ).toBeUndefined()
    }
  )

  it('opens a mirrorable draft launch in chat', () => {
    expect(
      decideInitialAgentTabViewMode({
        experimentalNativeChat: true,
        openAgentTabsInChatByDefault: true,
        agent: 'claude',
        promptDelivery: 'draft',
        launchDraftText: 'https://github.com/o/r/issues/12'
      })
    ).toBe('chat')
  })

  it.each([
    ['multi-line', 'Reproduce first\n\nhttps://github.com/o/r/issues/12'],
    ['trailing-newline', 'https://github.com/o/r/issues/12\n']
  ])('opens a %s draft in chat with its mirrored composer text', (_label, launchDraftText) => {
    expect(
      decideInitialAgentTabViewMode({
        experimentalNativeChat: true,
        openAgentTabsInChatByDefault: true,
        agent: 'claude',
        promptDelivery: 'draft',
        launchDraftText
      })
    ).toBe('chat')
  })

  it.each([
    ['Unicode-line-separator', 'one\u2028two'],
    ['blank', '   '],
    ['absent', undefined]
  ])('keeps a %s draft in the terminal, where its text actually is', (_label, launchDraftText) => {
    expect(
      decideInitialAgentTabViewMode({
        experimentalNativeChat: true,
        openAgentTabsInChatByDefault: true,
        agent: 'claude',
        promptDelivery: 'draft',
        ...(launchDraftText === undefined ? {} : { launchDraftText })
      })
    ).toBeUndefined()
  })

  it('returns tab creation props only when chat should be the initial mode', () => {
    expect(
      initialAgentTabViewModeProps(
        {
          experimentalNativeChat: true,
          openAgentTabsInChatByDefault: true
        },
        { agent: 'claude' }
      )
    ).toEqual({ viewMode: 'chat' })
    expect(
      initialAgentTabViewModeProps(
        {
          experimentalNativeChat: false,
          openAgentTabsInChatByDefault: true
        },
        { agent: 'claude' }
      )
    ).toEqual({})
  })
})
