import type { AiVaultSubagentListResult } from '../../shared/ai-vault-types'
import { listClaudeSubagentSessions } from './session-scanner-claude-subagents'
import type { AiVaultServiceSubagentRequest } from './session-scanner-service-protocol'

export function listLocalAiVaultSubagentSessions(
  request: AiVaultServiceSubagentRequest
): Promise<AiVaultSubagentListResult> {
  return request.agent === 'claude'
    ? listClaudeSubagentSessions({ parentFilePath: request.parentFilePath })
    : Promise.resolve({ sessions: [], issues: [] })
}
