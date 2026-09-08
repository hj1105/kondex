import { translate } from '@/i18n/i18n'
import { parseIssueLinkInput } from '../../../../shared/issue-link-input'
import {
  isIssueFieldDirty,
  type WorktreeMetaDraft,
  type WorktreeMetaSnapshot
} from './worktree-meta-updates'

function formatLinkLabel(value: string): string {
  return translate(
    'auto.components.sidebar.worktreeIssueDisplacement.9c4b7e1f60',
    'GitHub #{{value}}',
    {
      value
    }
  )
}

/** Names the persisted links a save would drop. A workspace tracks one issue, so
 *  a changed field can replace or clear its GitHub issue slot.
 *  Only a dirty field displaces anything — the dialog opens focused on Comment,
 *  and an untouched row must leave every link alone. */
export function getDisplacedLinkLabels(args: {
  draft: WorktreeMetaDraft
  snapshot: WorktreeMetaSnapshot
  isFolderWorkspace: boolean
  linkedIssue: number | null
}): string[] | null {
  const { draft, snapshot, isFolderWorkspace, linkedIssue } = args
  if (isFolderWorkspace || !isIssueFieldDirty(draft, snapshot)) {
    return null
  }

  const displaced: string[] = []
  const next = parseIssueLinkInput(draft.issueInput, draft.issueProvider)
  if (typeof linkedIssue === 'number' && next?.number !== linkedIssue) {
    displaced.push(formatLinkLabel(String(linkedIssue)))
  }
  return displaced.length > 0 ? displaced : null
}
