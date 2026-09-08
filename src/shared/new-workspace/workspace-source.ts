import type { FolderWorkspaceLinkedTask } from '../folder-workspace-types'
import {
  getLinkedWorkItemSuggestedName,
  getLinkedWorkItemWorkspaceName,
  type WorkspaceIntentWorkItem
} from '../workspace-name'
import { isWorkItemLookupText } from './work-item-lookup-text'

export type WorkspaceSourceProvider = FolderWorkspaceLinkedTask['provider']

export type WorkspaceSourceLinkedItem = FolderWorkspaceLinkedTask

export type GitHubWorkspaceSource = WorkspaceSourceLinkedItem & {
  provider: 'github'
  type: 'issue' | 'pr'
}

export type GitLabWorkspaceSource = WorkspaceSourceLinkedItem & {
  provider: 'gitlab'
  type: 'issue' | 'mr'
}

export type WorkspaceSourceItemLike = Omit<WorkspaceSourceLinkedItem, 'provider'> & {
  provider?: WorkspaceSourceProvider
}

export type WorkspaceSourceSelectionKind =
  | 'github-pr'
  | 'github-issue'
  | 'gitlab-mr'
  | 'gitlab-issue'
  | 'branch'

export type WorkspaceSourceSelection = {
  kind: WorkspaceSourceSelectionKind
  label: string
  url?: string
}

const GITLAB_ISSUE_PATH_RE = /\/-\/(?:issues|work_items)\//i

export function isGitLabIssueUrl(url: string): boolean {
  try {
    return GITLAB_ISSUE_PATH_RE.test(new URL(url).pathname)
  } catch {
    return GITLAB_ISSUE_PATH_RE.test(url)
  }
}

export function getWorkspaceSourceProvider(item: WorkspaceSourceItemLike): WorkspaceSourceProvider {
  if (item.provider) {
    return item.provider
  }
  if (item.type === 'mr' || isGitLabIssueUrl(item.url)) {
    return 'gitlab'
  }
  return 'github'
}

export function buildGitHubWorkspaceSource(item: {
  type: 'issue' | 'pr'
  number: number
  title: string
  url: string
  repoId?: string
}): GitHubWorkspaceSource {
  return { provider: 'github', ...item }
}

export function buildGitLabWorkspaceSource(item: {
  type: 'issue' | 'mr'
  number: number
  title: string
  url: string
  repoId?: string
}): GitLabWorkspaceSource {
  return { provider: 'gitlab', ...item }
}

export function shouldApplyWorkspaceSourceAutoName(args: {
  currentName: string
  lastAutoName: string
}): boolean {
  return (
    !args.currentName.trim() ||
    args.currentName === args.lastAutoName ||
    isWorkItemLookupText(args.currentName)
  )
}

function toWorkspaceIntentItem(item: WorkspaceSourceItemLike): WorkspaceIntentWorkItem {
  return { ...item, provider: getWorkspaceSourceProvider(item) }
}

export function getWorkspaceSourceName(item: WorkspaceSourceItemLike): {
  seedName: string
  displayName: string
} {
  const normalized = toWorkspaceIntentItem(item)
  const resolved = getLinkedWorkItemWorkspaceName(normalized)
  return {
    seedName: resolved?.seedName ?? getLinkedWorkItemSuggestedName(normalized),
    displayName: resolved?.displayName ?? item.title.trim()
  }
}

export function buildWorkspaceSourceSelection(args: {
  linkedWorkItem: WorkspaceSourceItemLike | null
  baseBranch?: string
}): WorkspaceSourceSelection | null {
  const { linkedWorkItem, baseBranch } = args
  if (!linkedWorkItem) {
    return baseBranch ? { kind: 'branch', label: baseBranch } : null
  }
  const provider = getWorkspaceSourceProvider(linkedWorkItem)
  const kind: WorkspaceSourceSelectionKind =
    provider === 'gitlab'
      ? linkedWorkItem.type === 'mr'
        ? 'gitlab-mr'
        : 'gitlab-issue'
      : linkedWorkItem.type === 'pr'
        ? 'github-pr'
        : 'github-issue'
  return {
    kind,
    label: `#${linkedWorkItem.number} ${linkedWorkItem.title}`,
    url: linkedWorkItem.url
  }
}

export function shouldPreserveWorkspaceSourceOnRepoChange(
  _item: WorkspaceSourceItemLike | null
): boolean {
  return false
}
