import {
  CLAUDE_IDLE,
  isClaudeAgent,
  isClaudeManagementTitle,
  titleHasAgentName
} from './agent-title-core'
import { memoizeTitleClassification } from './terminal-title-classification-memo'

export { isClaudeAgent }

function computeAgentLabel(title: string): string | null {
  if (!title || isClaudeManagementTitle(title)) {
    return null
  }
  if (
    title.startsWith(`${CLAUDE_IDLE} `) ||
    title === CLAUDE_IDLE ||
    title.startsWith('. ') ||
    title.startsWith('* ')
  ) {
    return 'Claude Code'
  }
  if (titleHasAgentName(title, 'codex')) {
    return 'Codex'
  }
  return isClaudeAgent(title) ? 'Claude Code' : null
}

export const getAgentLabel: (title: string) => string | null =
  memoizeTitleClassification(computeAgentLabel)
