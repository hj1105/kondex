import type { AgentStatusEntry, AgentType } from './agent-status-types'

export type CompatibleAgentOwnerOptions = {
  ownerIsLaunch?: boolean
}

export function hasCompatibleAgentTitleIdentity(_title: string): boolean {
  return false
}

export function resolveCompatibleAgentTypeForOwner(
  incomingAgentType: AgentType | null | undefined,
  _ownerAgentType: AgentType | null | undefined,
  _options?: CompatibleAgentOwnerOptions
): AgentType | undefined {
  return incomingAgentType ?? undefined
}

export function normalizeCompatibleAgentTitleForOwner(
  title: string,
  _ownerAgentType: AgentType | null | undefined,
  _options?: CompatibleAgentOwnerOptions
): string {
  return title
}

export function normalizeCompatibleAgentStatusEntryForOwner(
  entry: AgentStatusEntry,
  _ownerAgentType: AgentType | null | undefined,
  _options?: CompatibleAgentOwnerOptions
): AgentStatusEntry {
  return entry
}

export function shareCompatibleTitleIdentityGroup(
  left: AgentType | null | undefined,
  right: AgentType | null | undefined
): boolean {
  return Boolean(left && right && left === right)
}
