import { describe, expect, it } from 'vitest'
import { getNativeChatAgentProfile } from './native-chat-agent-profiles'

describe('native chat agent picker profiles', () => {
  it('keeps Codex dollar skills separate from slash commands', () => {
    expect(getNativeChatAgentProfile('codex')).toMatchObject({
      skillPrefix: '$',
      groupedSlash: false,
      skillSourceOwner: 'codex'
    })
  })

  it('groups Claude skills under slash', () => {
    expect(getNativeChatAgentProfile('claude')).toMatchObject({
      skillPrefix: '/',
      groupedSlash: true,
      skillSourceOwner: 'claude'
    })
  })

  it.each(['custom-agent', 'openclaude', 'grok'])('does not grant %s a skill grammar', (agent) => {
    expect(getNativeChatAgentProfile(agent)).toBeNull()
  })
})
