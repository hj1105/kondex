import type React from 'react'
import { ClaudeIcon, OpenAIIcon } from '@/components/status-bar/icons'
import { translate } from '@/i18n/i18n'
import { createLocalizedCatalog } from '@/i18n/localized-catalog'
import type { TuiAgent } from '../../../shared/tui-agent'
import { AgentLetterIcon } from './agent-icon-glyphs'

export type AgentCatalogEntry = {
  id: TuiAgent
  label: string
  cmd: string
  homepageUrl: string
}

export const getAgentCatalog = createLocalizedCatalog((): AgentCatalogEntry[] => [
  {
    id: 'claude',
    label: translate('auto.lib.agent.catalog.0708ed89f1', 'Claude'),
    cmd: 'claude',
    homepageUrl: 'https://code.claude.com/docs'
  },
  {
    id: 'codex',
    label: translate('auto.lib.agent.catalog.760bc6883d', 'Codex'),
    cmd: 'codex',
    homepageUrl: 'https://github.com/openai/codex'
  }
])

export const AGENT_CATALOG: AgentCatalogEntry[] = getAgentCatalog()

export function getAgentLabel(agent: TuiAgent): string {
  return getAgentCatalog().find((entry) => entry.id === agent)?.label ?? agent
}

export function AgentIcon({
  agent,
  size = 14
}: {
  agent: TuiAgent | null | undefined
  size?: number
}): React.JSX.Element {
  if (agent === 'claude') {
    return <ClaudeIcon size={size} />
  }
  if (agent === 'codex') {
    return <OpenAIIcon size={size} />
  }
  return <AgentLetterIcon letter="?" size={size} />
}
