import { getCommitMessageAgentSpec, type CommitMessageAgentSpec } from './commit-message-agent-spec'
import type { TuiAgent } from './tui-agent'

/** Why: model discovery reads only these fields; excluding the prompt-delivery
 *  half is what keeps a probe-only agent out of the commit-message registry. */
export type AgentModelProbeSpec = Omit<CommitMessageAgentSpec, 'promptDelivery' | 'buildArgs'>

export function getAgentModelProbeSpec(agentId: TuiAgent): AgentModelProbeSpec | undefined {
  return getCommitMessageAgentSpec(agentId)
}
