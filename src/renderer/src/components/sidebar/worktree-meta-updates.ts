import { parseGitHubIssueOrPRLink, parseGitHubIssueOrPRNumber } from '@/lib/github-links'
import { parseIssueLinkInput, type IssueLinkProvider } from '../../../../shared/issue-link-input'
import type { WorkspaceSourceProvider } from '../../../../shared/new-workspace/workspace-source'
import type { WorktreeMeta } from '../../../../shared/worktree/meta-types'
import type { WorkspaceLinkedItem } from '../../../../shared/worktree/types'
import { parseGitLabIssueOrMRLink } from '../../../../shared/new-workspace/gitlab-links'

export type WorktreeReviewProvider = 'github' | 'gitlab'

export type WorktreeMetaSavedPayload = {
  worktreeId: string
  updates: Partial<WorktreeMeta>
}

/** What the user currently has typed in the dialog. */
export type WorktreeMetaDraft = {
  displayNameInput: string
  issueInput: string
  issueProvider: IssueLinkProvider
  reviewInput: string
  commentInput: string
}

/** The persisted state the dialog was seeded from. Captured once when the
 *  dialog opens: comparing a frozen draft against a live store would let a
 *  background write move the baseline and make an untouched field "dirty". */
export type WorktreeMetaSnapshot = {
  displayName: string
  comment: string
  issueInput: string
  issueProvider: IssueLinkProvider
  prInput: string
}

/** The link state as it stands now, read at save time rather than at open.
 *  Displacement is decided against this: a CLI or background write that landed
 *  while the dialog was open must not survive a save the dialog warned would
 *  displace it, and a clear must not be emitted for a slot that is already empty
 *  — persistence only receives fields owned by this dialog. */
export type WorktreeMetaLiveLinks = {
  linkedPR?: number | null
  linkedIssue?: number | null
  linkedWorkItemProvider?: WorkspaceSourceProvider | null
  /** `linkedWorkItem` also describes PRs and MRs, which this row does not own. */
  linkedWorkItemType?: WorkspaceLinkedItem['type'] | null
}

export function parseExplicitGitHubIssueUrl(input: string): string | null {
  const trimmed = input.trim()
  const link = parseGitHubIssueOrPRLink(trimmed)
  if (!link || link.type !== 'issue') {
    return null
  }

  return trimmed
}

export function parseGitHubWorkItemNumberForMetaField(
  input: string,
  expectedType: 'issue' | 'pr'
): number | null {
  const link = parseGitHubIssueOrPRLink(input)
  if (link) {
    // Why: issue and PR numbers live in separate GitHub namespaces for refs;
    // a URL path mismatch must not silently link the other field.
    return link.type === expectedType ? link.number : null
  }

  return parseGitHubIssueOrPRNumber(input)
}

export function parseGitLabMergeRequestNumberForMetaField(input: string): number | null {
  const trimmed = input.trim()
  const direct = trimmed.startsWith('!') ? trimmed.slice(1) : trimmed
  if (/^\d+$/.test(direct)) {
    const number = Number(direct)
    return Number.isSafeInteger(number) && number > 0 ? number : null
  }
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return null
  }
  const link = parseGitLabIssueOrMRLink(trimmed)
  return link?.type === 'mr' && Number.isSafeInteger(link.number) && link.number > 0
    ? link.number
    : null
}

// Why: blanking the field means "fall back to the branch/folder name", and the
// empty string is how that intent is persisted. Emitting `undefined` instead
// put a present-but-undefined key into the store spread, wiping the live name
// and crashing the worktree palette (crash a1f81ea1).
function buildDisplayNameUpdate(
  draft: WorktreeMetaDraft,
  current: WorktreeMetaSnapshot
): Partial<WorktreeMeta> {
  const trimmed = draft.displayNameInput.trim()
  return trimmed === current.displayName ? {} : { displayName: trimmed }
}

// Why: persistence bumps lastActivityAt whenever a `comment` key is present, so
// re-emitting an unchanged note reorders the workspace under the time-decay
// sidebar sort on a save that only touched the issue link.
function buildCommentUpdate(
  draft: WorktreeMetaDraft,
  current: WorktreeMetaSnapshot
): Partial<WorktreeMeta> {
  const trimmed = draft.commentInput.trim()
  return trimmed === current.comment ? {} : { comment: trimmed }
}

/** Which GitHub issue a value names, ignoring spelling (`42`, `#42`, or URL). */
function issueLinkIdentity(input: string, provider: IssueLinkProvider): string {
  const trimmed = input.trim()
  if (trimmed === '') {
    return ''
  }
  const parsed = parseIssueLinkInput(trimmed, provider)
  if (!parsed) {
    return `raw:${provider}:${trimmed}`
  }
  return `github:${parsed.number}`
}

// Why: normalized identity rather than trimmed text. Retyping the same issue in
// another spelling — `42` to `#42` or its URL — would otherwise enter
// the displacement path and clear the title and source context of the very link
// it re-states.
export function isIssueFieldDirty(
  draft: WorktreeMetaDraft,
  current: WorktreeMetaSnapshot
): boolean {
  return (
    issueLinkIdentity(draft.issueInput, draft.issueProvider) !==
    issueLinkIdentity(current.issueInput, current.issueProvider)
  )
}

/** Whether the value being saved names the GitHub issue `linkedWorkItem` already describes. */
function keepsLinkedWorkItem(
  input: string,
  provider: IssueLinkProvider,
  live: WorktreeMetaLiveLinks
): boolean {
  const parsed = parseIssueLinkInput(input.trim(), provider)
  if (!parsed || live.linkedWorkItemType !== 'issue') {
    return false
  }
  return live.linkedWorkItemProvider === 'github' && parsed.number === live.linkedIssue
}

/** Owns the GitHub issue slot. Emits nothing at all unless the field changed —
 *  the dialog opens focused on Comment, so an untouched field must never
 *  destroy a link the user came here to keep. */
function buildIssueLinkUpdates(
  draft: WorktreeMetaDraft,
  current: WorktreeMetaSnapshot,
  live: WorktreeMetaLiveLinks
): Partial<WorktreeMeta> {
  if (!isIssueFieldDirty(draft, current)) {
    return {}
  }

  const trimmed = draft.issueInput.trim()
  // Why: the linked work item and its source context describe the issue being
  // replaced. Leaving them would keep a stale title badge and source context
  // reads — but only when the save names a *different* issue: a value that
  // re-states the same one, such as a URL adding an org key, must keep its own
  // title and SSH/runtime routing context. Narrow on purpose: `type` because the
  // field also records the PR or MR a workspace was created from, and provider
  // because GitLab issues have no slot in this row — displacing what it
  // cannot display would destroy a link the user was never shown and has no
  // other editor to restore it from.
  const displacedWorkItem: Partial<WorktreeMeta> =
    !keepsLinkedWorkItem(trimmed, draft.issueProvider, live) &&
    live.linkedWorkItemProvider === 'github' &&
    live.linkedWorkItemType === 'issue'
      ? { linkedWorkItem: null, linkedTaskSourceContext: null }
      : {}

  if (trimmed === '') {
    return {
      linkedIssue: null,
      ...displacedWorkItem
    }
  }

  const parsed = parseIssueLinkInput(trimmed, draft.issueProvider)
  if (!parsed) {
    // Why: unparseable input leaves every link untouched. `canSave` already
    // blocks this path, but the builder stays pure rather than relying on it.
    return {}
  }

  return { linkedIssue: parsed.number, ...displacedWorkItem }
}

function buildReviewLinkUpdate(
  draft: WorktreeMetaDraft,
  current: WorktreeMetaSnapshot,
  live: WorktreeMetaLiveLinks,
  provider: WorktreeReviewProvider
): Partial<WorktreeMeta> {
  const trimmed = draft.reviewInput.trim()
  if (provider === 'github' && trimmed === current.prInput.trim()) {
    return {}
  }
  if (trimmed === '') {
    return provider === 'gitlab'
      ? { linkedGitLabMR: null }
      : {
          linkedPR: null,
          ...(typeof live.linkedPR === 'number' ? { suppressedGitHubPR: live.linkedPR } : {})
        }
  }
  const number =
    provider === 'gitlab'
      ? parseGitLabMergeRequestNumberForMetaField(trimmed)
      : parseGitHubWorkItemNumberForMetaField(trimmed, 'pr')
  if (number === null) {
    return {}
  }
  return provider === 'gitlab' ? { linkedGitLabMR: number } : { linkedPR: number }
}

/** Pure save-payload builder for the worktree meta dialog: empty inputs clear
 *  the link (null), unparseable inputs leave it untouched (omitted). No key is
 *  ever emitted holding `undefined` — persistence raw-spreads updates, so a
 *  present-but-undefined key erases the stored value. */
export function buildWorktreeMetaUpdates(
  draft: WorktreeMetaDraft,
  current: WorktreeMetaSnapshot,
  live: WorktreeMetaLiveLinks,
  reviewProvider: WorktreeReviewProvider = 'github'
): Partial<WorktreeMeta> {
  return {
    ...buildCommentUpdate(draft, current),
    ...buildDisplayNameUpdate(draft, current),
    ...buildIssueLinkUpdates(draft, current, live),
    ...buildReviewLinkUpdate(draft, current, live, reviewProvider)
  }
}
