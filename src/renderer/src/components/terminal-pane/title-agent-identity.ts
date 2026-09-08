import { titleHasAnyLegacyAgentName } from '../../../../shared/agent-name-token-match'

export function titleHasExplicitAgentIdentity(title: string): boolean {
  if (!title) {
    return false
  }
  if (title.startsWith('. ') || title.startsWith('* ') || title.startsWith('\u2733')) {
    return true
  }
  return titleHasAnyLegacyAgentName(title)
}
