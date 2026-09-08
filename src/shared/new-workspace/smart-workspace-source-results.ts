import type { GitHubWorkItem } from '../github/work-item-types'
import type { GitLabWorkItem } from '../gitlab-types'
import type { BaseRefSearchResult } from '../repo-types'
import type { GitHubIssueOrPRLink } from '../github/links'
import {
  buildSmartWorkspaceUrlSourceRows,
  type SmartWorkspaceGitLabUrlIntent
} from './smart-workspace-url-source-results'
import { isSmartWorkspaceSourceQueryWithinLimit } from './smart-workspace-source-query'

export {
  SMART_WORKSPACE_SOURCE_QUERY_MAX_BYTES,
  isSmartWorkspaceSourceQueryWithinLimit
} from './smart-workspace-source-query'

export type SmartNameMode = 'smart' | 'github' | 'gitlab' | 'branches' | 'text'

export type SmartWorkspaceSourceRow =
  | { kind: 'use-name'; value: string; name: string }
  | { kind: 'create-branch'; value: string; name: string }
  | { kind: 'github'; value: string; item: GitHubWorkItem }
  | { kind: 'gitlab'; value: string; item: GitLabWorkItem }
  | { kind: 'branch'; value: string; refName: string; localBranchName: string }

const EMPTY_HINT_BY_MODE: Record<SmartNameMode, string> = {
  smart: 'Start typing to create a name or find a source.',
  github: 'Start typing to search GitHub PRs and issues.',
  gitlab: 'Start typing to search GitLab MRs and issues.',
  branches: 'No matching branches.',
  text: ''
}

export function getSmartWorkspaceEmptyHint(mode: SmartNameMode): string {
  return EMPTY_HINT_BY_MODE[mode]
}

export function isBlockingTaskUrlResolution({
  sourceIntent,
  isQueryStale,
  githubLoading,
  gitlabLoading
}: {
  sourceIntent: 'github' | 'gitlab' | null
  isQueryStale: boolean
  githubLoading: boolean
  gitlabLoading: boolean
}): boolean {
  if (sourceIntent === null) {
    return false
  }
  return isQueryStale || (sourceIntent === 'github' ? githubLoading : gitlabLoading)
}

function toGitHubSourceRow(item: GitHubWorkItem): SmartWorkspaceSourceRow {
  return { kind: 'github', value: `github-${item.repoId}-${item.type}-${item.number}`, item }
}

export function getBranchSearchRequest({
  branchesEnabled,
  disabled,
  textOnly,
  mode,
  selectedRepoId,
  query,
  limit
}: {
  branchesEnabled?: boolean
  disabled: boolean
  textOnly: boolean
  mode: SmartNameMode
  selectedRepoId: string | null
  query: string
  limit: number
}): { repoId: string; query: string; limit: number } | null {
  if (
    branchesEnabled === false ||
    disabled ||
    textOnly ||
    !isSmartWorkspaceSourceQueryWithinLimit(query) ||
    !selectedRepoId
  ) {
    return null
  }
  const trimmedQuery = query.trim()
  const shouldSearchBranches = mode === 'branches' || (mode === 'smart' && trimmedQuery.length > 0)
  if (!shouldSearchBranches) {
    return null
  }
  return { repoId: selectedRepoId, query: trimmedQuery, limit }
}

/**
 * Why: provider arrays lag the live input (200ms debounce). Keep them while the
 * user is still typing, but hide immediately when the field is cleared so prior
 * non-empty results cannot stay selectable until debounce catches up.
 */
export function getVisibleHeldProviderResults<T>({
  items,
  value,
  debouncedQuery
}: {
  items: readonly T[]
  value: string
  debouncedQuery: string
}): T[] {
  if (!isSmartWorkspaceSourceQueryWithinLimit(value)) {
    return []
  }
  if (value.trim() === '' && debouncedQuery.trim() !== '') {
    return []
  }
  return items.slice()
}

export function getVisibleBranchResults({
  branches,
  mode,
  resultRepoId,
  resultQuery,
  selectedRepoId,
  value
}: {
  branches: BaseRefSearchResult[]
  mode: SmartNameMode
  resultRepoId: string | null
  resultQuery: string | null
  selectedRepoId: string | null
  value: string
}): BaseRefSearchResult[] {
  if (!isSmartWorkspaceSourceQueryWithinLimit(value)) {
    return []
  }
  if (mode !== 'branches' && mode !== 'smart') {
    return []
  }
  if (!selectedRepoId || resultRepoId !== selectedRepoId || resultQuery === null) {
    return []
  }
  const currentQuery = value.trim()
  // Why: hold the last settled list while the user extends/trims the query so the
  // dropdown does not blank between debounced keystrokes. Drop the hold when the
  // query diverges (e.g. "feat" → "bug") so unrelated rows do not linger.
  if (currentQuery === '') {
    return resultQuery === '' ? branches : []
  }
  if (!shouldHoldSourceResultsForQuery({ resultQuery, value: currentQuery })) {
    return []
  }
  return branches
}

/** Max |live − settled| length while still treating a prefix as "still typing". */
const SOURCE_RESULT_HOLD_MAX_DELTA = 4

/**
 * Why: prefix-only hold lets a settled "f" stick under "fix-unrelated-…" for the
 * whole next debounce. Cap the length delta so hold covers fast typing, not long
 * continuations of a short settled query.
 */
export function shouldHoldSourceResultsForQuery({
  resultQuery,
  value
}: {
  resultQuery: string
  value: string
}): boolean {
  const currentQueryKey = value.trim().toLowerCase()
  const resultQueryKey = resultQuery.trim().toLowerCase()
  if (resultQueryKey === currentQueryKey) {
    return true
  }
  if (!currentQueryKey.startsWith(resultQueryKey) && !resultQueryKey.startsWith(currentQueryKey)) {
    return false
  }
  return Math.abs(currentQueryKey.length - resultQueryKey.length) <= SOURCE_RESULT_HOLD_MAX_DELTA
}

export function buildSmartWorkspaceSourceRows({
  branches,
  githubItems,
  githubUrlIntent,
  gitlabAvailable,
  gitlabItems,
  gitlabUrlIntent,
  mode,
  resultLimit,
  value
}: {
  branches: BaseRefSearchResult[]
  githubItems: GitHubWorkItem[]
  githubUrlIntent?: GitHubIssueOrPRLink | null
  gitlabAvailable: boolean
  gitlabItems: GitLabWorkItem[]
  gitlabUrlIntent?: SmartWorkspaceGitLabUrlIntent | null
  mode: SmartNameMode
  resultLimit: number
  value: string
}): SmartWorkspaceSourceRow[] {
  if (!isSmartWorkspaceSourceQueryWithinLimit(value)) {
    return []
  }
  // Why: a full task URL is unambiguous, so unrelated held rows must never remain selectable.
  const urlSourceRows = buildSmartWorkspaceUrlSourceRows({
    githubItems,
    githubUrlIntent,
    gitlabAvailable,
    gitlabItems,
    gitlabUrlIntent,
    mode,
    resultLimit,
    value
  })
  if (urlSourceRows !== null) {
    return urlSourceRows
  }
  const trimmed = value.trim()
  const nextRows: SmartWorkspaceSourceRow[] = []
  if (trimmed && mode === 'smart') {
    // Why: stable cmdk value — embedding the query remounted the row every keystroke.
    nextRows.push({ kind: 'use-name', value: 'use-name', name: trimmed })
  }
  if (mode === 'text') {
    return nextRows
  }
  if (mode === 'smart' || mode === 'github') {
    nextRows.push(...githubItems.map(toGitHubSourceRow))
  }
  if (gitlabAvailable && (mode === 'smart' || mode === 'gitlab')) {
    nextRows.push(
      ...gitlabItems.map((item) => ({
        kind: 'gitlab' as const,
        value: `gitlab-${item.repoId}-${item.type}-${item.number}`,
        item
      }))
    )
  }
  const shouldShowBranches = mode === 'branches' || (mode === 'smart' && trimmed.length > 0)
  if (shouldShowBranches) {
    const branchExactMatch = branches.some(
      (branch) => branch.refName === trimmed || branch.localBranchName === trimmed
    )
    if (trimmed && mode === 'branches' && !branchExactMatch) {
      nextRows.push({ kind: 'create-branch', value: 'create-branch', name: trimmed })
    }
    nextRows.push(
      ...branches.map((branch) => ({
        kind: 'branch' as const,
        value: `branch-${branch.refName}`,
        refName: branch.refName,
        localBranchName: branch.localBranchName
      }))
    )
  }
  return nextRows.slice(0, resultLimit + 1)
}
