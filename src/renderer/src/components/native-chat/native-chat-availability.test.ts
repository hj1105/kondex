import { describe, it, expect } from 'vitest'
import { canSwitchNativeChatView, canToggleNativeChat } from './native-chat-availability'
import { isNativeChatTranscriptLocalReadable } from '@/lib/native-chat-transcript-readability'

describe('canToggleNativeChat', () => {
  it('allows a terminal launched with a supported coding agent', () => {
    expect(
      canToggleNativeChat({
        experimentalNativeChatEnabled: true,
        contentType: 'terminal',
        launchAgent: 'claude'
      })
    ).toBe(true)
  })

  it('allows a terminal with a live detected supported agent but no launchAgent', () => {
    expect(
      canToggleNativeChat({
        experimentalNativeChatEnabled: true,
        contentType: 'terminal',
        launchAgent: null,
        detectedAgent: 'codex'
      })
    ).toBe(true)
  })

  it('allows a terminal with a resolved title/foreground supported agent before hooks arrive', () => {
    expect(
      canToggleNativeChat({
        experimentalNativeChatEnabled: true,
        contentType: 'terminal',
        launchAgent: null,
        resolvedAgent: 'claude'
      })
    ).toBe(true)
  })

  it('allows an existing chat view to toggle back after live signals are gone', () => {
    expect(
      canToggleNativeChat({
        experimentalNativeChatEnabled: true,
        contentType: 'terminal',
        launchAgent: null,
        isChatViewMode: true
      })
    ).toBe(true)
  })

  it.each(['claude', 'codex'] as const)(
    'allows %s transcript routing on local and remote hosts',
    (agent) => {
      for (const connectionId of [null, 'ssh-target-1', 'runtime-ssh-env-1']) {
        expect(
          canToggleNativeChat({
            experimentalNativeChatEnabled: true,
            contentType: 'terminal',
            launchAgent: agent,
            nativeChatTranscriptIsLocalReadable: isNativeChatTranscriptLocalReadable(connectionId)
          })
        ).toBe(true)
      }
    }
  )

  it.each(['gemini', 'opencode'] as const)(
    'rejects unsupported agent %s detected live',
    (agent) => {
      expect(
        canToggleNativeChat({
          experimentalNativeChatEnabled: true,
          contentType: 'terminal',
          launchAgent: null,
          detectedAgent: agent
        })
      ).toBe(false)
    }
  )

  it('rejects a stale supported title when live detection found an unsupported agent', () => {
    expect(
      canToggleNativeChat({
        experimentalNativeChatEnabled: true,
        contentType: 'terminal',
        launchAgent: null,
        detectedAgent: 'gemini',
        resolvedAgent: 'codex'
      })
    ).toBe(false)
  })

  it('rejects stale launch metadata when live detection found an unsupported agent', () => {
    expect(
      canToggleNativeChat({
        experimentalNativeChatEnabled: true,
        contentType: 'terminal',
        launchAgent: 'codex',
        detectedAgent: 'gemini'
      })
    ).toBe(false)
  })

  it('rejects a stale supported title when launch metadata names an unsupported agent', () => {
    expect(
      canToggleNativeChat({
        experimentalNativeChatEnabled: true,
        contentType: 'terminal',
        // @ts-expect-error Legacy launch metadata can name a retired provider.
        launchAgent: 'gemini',
        resolvedAgent: 'claude'
      })
    ).toBe(false)
  })

  it('rejects otherwise eligible terminals while the experimental flag is off', () => {
    expect(
      canToggleNativeChat({
        experimentalNativeChatEnabled: false,
        contentType: 'terminal',
        launchAgent: 'claude'
      })
    ).toBe(false)
  })

  it('rejects a plain shell terminal with no agent', () => {
    expect(
      canToggleNativeChat({
        experimentalNativeChatEnabled: true,
        contentType: 'terminal',
        launchAgent: null,
        detectedAgent: null
      })
    ).toBe(false)
  })

  it('rejects a plain shell terminal with everything omitted', () => {
    expect(
      canToggleNativeChat({ experimentalNativeChatEnabled: true, contentType: 'terminal' })
    ).toBe(false)
  })

  it('rejects an editor tab even if a supported agent hint were somehow present', () => {
    expect(
      canToggleNativeChat({
        experimentalNativeChatEnabled: true,
        contentType: 'editor',
        launchAgent: 'codex',
        detectedAgent: 'codex'
      })
    ).toBe(false)
  })

  it('rejects a browser tab', () => {
    expect(
      canToggleNativeChat({
        experimentalNativeChatEnabled: true,
        contentType: 'browser',
        detectedAgent: 'claude'
      })
    ).toBe(false)
  })
})

describe('canSwitchNativeChatView', () => {
  it('allows bridge chat to expose a terminal/chat switcher', () => {
    expect(
      canSwitchNativeChatView({
        experimentalNativeChatEnabled: true,
        contentType: 'terminal',
        launchAgent: 'claude'
      })
    ).toBe(true)
  })

  it('keeps structured sessions free of terminal/chat switchers', () => {
    expect(
      canSwitchNativeChatView({
        experimentalNativeChatEnabled: true,
        contentType: 'terminal',
        launchAgent: 'codex',
        structuredSessionId: 'thread-1'
      })
    ).toBe(false)
  })

  it('keeps structured sessions hidden even when toggling back', () => {
    expect(
      canSwitchNativeChatView({
        experimentalNativeChatEnabled: true,
        contentType: 'terminal',
        isChatViewMode: true,
        structuredSessionId: 'thread-1'
      })
    ).toBe(false)
  })
})
