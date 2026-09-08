import type { TuiAgent } from '../../../../shared/tui-agent'
import type { StatusBarItem } from '../../../../shared/ui-chrome-types'

const CLI_GATED_ITEMS: ReadonlySet<StatusBarItem> = new Set(['claude', 'codex'])

export function isStatusBarItemAvailable(
  id: StatusBarItem,
  detectedAgentIds: TuiAgent[] | null
): boolean {
  if (!CLI_GATED_ITEMS.has(id) || detectedAgentIds === null) {
    return true
  }
  return detectedAgentIds.includes(id as TuiAgent)
}
