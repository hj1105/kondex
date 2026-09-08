import { containsAgentSpinnerGlyph, titleHasAgentName } from './agent-title-core'
import { getAgentLabel } from './agent-title-identity'
import { resolveCanonicalPaneAgentIdentity } from './pane-agent-identity-adapter'
import { memoizeTitleClassification } from './terminal-title-classification-memo'
import type { TuiAgent } from './tui-agent'

const TITLE_LABEL_TO_AGENT: Readonly<Record<string, TuiAgent>> = {
  'Claude Code': 'claude',
  Codex: 'codex'
}

function hasGenericClaudeStatusPrefix(title: string): boolean {
  return (
    containsAgentSpinnerGlyph(title) ||
    title.startsWith('✳ ') ||
    title === '✳' ||
    title.startsWith('. ') ||
    title.startsWith('* ')
  )
}

export { isClaudeIdentityFrameTitle } from './agent-title-core'

export function resolveTerminalTitleAgentType(title: string): TuiAgent | null {
  const label = getAgentLabel(title)
  const parsed = label ? (TITLE_LABEL_TO_AGENT[label] ?? null) : null
  return resolveCanonicalPaneAgentIdentity({
    title,
    uncoveredFallback: { agent: parsed, titleOnly: false }
  }).agent
}

function computeExplicitTerminalTitleAgentType(title: string): TuiAgent | null {
  const titleAgent = resolveTerminalTitleAgentType(title)
  if (
    titleAgent === 'claude' &&
    hasGenericClaudeStatusPrefix(title) &&
    !titleHasAgentName(title, 'claude')
  ) {
    return null
  }
  return titleAgent
}

export const resolveExplicitTerminalTitleAgentType: (title: string) => TuiAgent | null =
  memoizeTitleClassification(computeExplicitTerminalTitleAgentType)
