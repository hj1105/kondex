import type { AgentStatusState, AgentType } from './agent-status-types'
import type { TuiAgent } from './tui-agent'

export type SyntheticAgentTitleProfile = {
  workingLabel: string
  permissionLabel: string
  idleLabel: string
  titleIdentityGroup?: string
  synthesizeTerminalTitle?: boolean
  synthesizeWorkingTitle?: boolean
}

export const SYNTHETIC_AGENT_TITLE_AGENTS = ['codex'] as const satisfies readonly TuiAgent[]

export const SYNTHETIC_AGENT_TITLE_PROFILES: Record<string, SyntheticAgentTitleProfile> = {
  codex: {
    workingLabel: 'Codex',
    permissionLabel: 'Codex - action required',
    idleLabel: 'Codex ready',
    // Why: Codex emits working OSC titles but can miss the final frame.
    // Only synthesize terminal states so native spinner behavior stays intact.
    synthesizeWorkingTitle: false
  }
}

export function getSyntheticAgentTitleProfile(
  agentType: AgentType | null | undefined
): SyntheticAgentTitleProfile | null {
  if (!agentType) {
    return null
  }
  return SYNTHETIC_AGENT_TITLE_PROFILES[agentType] ?? null
}

export function getSyntheticAgentTerminalTitle(
  agentType: AgentType | null | undefined,
  state: AgentStatusState
): string | null {
  const profile = getSyntheticAgentTitleProfile(agentType)
  if (!profile || profile.synthesizeTerminalTitle === false || state === 'working') {
    return null
  }
  return state === 'blocked' || state === 'waiting' ? profile.permissionLabel : profile.idleLabel
}

export function shouldDriveSyntheticAgentTitleFromHook(
  agentType: AgentType | null | undefined,
  state: AgentStatusState
): boolean {
  const profile = getSyntheticAgentTitleProfile(agentType)
  if (!profile || profile.synthesizeTerminalTitle === false) {
    return false
  }
  return state !== 'working' || profile.synthesizeWorkingTitle !== false
}
