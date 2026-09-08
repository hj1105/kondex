import type { AgentType } from './agent-status-types'

// Shared so the desktop renderer and remote clients show the same agent name
// (e.g. native chat's empty state on both surfaces) from one source of truth.
const WELL_KNOWN_LABELS: Record<string, string> = {
  claude: 'Claude',
  codex: 'Codex'
}

export function formatAgentTypeLabel(agentType: AgentType | null | undefined): string {
  if (!agentType || agentType === 'unknown') {
    return 'Agent'
  }
  // Capitalize well-known names nicely; pass through custom names as-is
  return WELL_KNOWN_LABELS[agentType] ?? agentType
}
