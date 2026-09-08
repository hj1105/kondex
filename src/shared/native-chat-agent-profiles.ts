import type { AgentType } from './agent-status-types'
import { getAgentSlashCommands, type SlashCommandSuggestion } from './native-chat-slash-commands'

export type NativeChatAgentProfile = {
  skillPrefix: '$' | '/'
  groupedSlash: boolean
  skillSourceOwner: AgentType
}

const NATIVE_CHAT_AGENT_PROFILES: Partial<Record<AgentType, NativeChatAgentProfile>> = {
  codex: {
    skillPrefix: '$',
    groupedSlash: false,
    skillSourceOwner: 'codex'
  },
  claude: {
    skillPrefix: '/',
    groupedSlash: true,
    skillSourceOwner: 'claude'
  }
}

export function getNativeChatAgentProfile(
  agent: AgentType | null | undefined
): NativeChatAgentProfile | null {
  return agent ? (NATIVE_CHAT_AGENT_PROFILES[agent] ?? null) : null
}

export function getVerifiedNativeChatCommands(agent: AgentType): readonly SlashCommandSuggestion[] {
  return getAgentSlashCommands(agent)
}
