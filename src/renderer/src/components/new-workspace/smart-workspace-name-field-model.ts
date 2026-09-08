import type React from 'react'
import type { useAppStore } from '@/store'
import type { parseGitHubIssueOrPRLink, RepoSlug } from '@/lib/github-links'
import type { GitHubWorkItem } from '../../../../shared/github/work-item-types'
import type { GitLabWorkItem } from '../../../../shared/gitlab-types'
import type { BaseRefSearchResult } from '../../../../shared/repo-types'
import type { TaskSourceContext } from '../../../../shared/task-source-context'
import type { SmartNameMode, SmartWorkspaceSourceRow } from './smart-workspace-source-results'

export type RepoOption = ReturnType<typeof useAppStore.getState>['repos'][number]

export type SmartWorkspaceNameFieldProps = {
  repos: readonly RepoOption[]
  repoId: string
  onRepoChange: (repoId: string) => void
  value: string
  onValueChange: (value: string) => void
  onGitHubItemSelect: (item: GitHubWorkItem) => void
  onGitLabItemSelect?: (item: GitLabWorkItem) => void
  onBranchSelect: (refName: string, localBranchName: string) => void
  selectedSource: SmartWorkspaceNameSelection | null
  onClearSelectedSource: () => void
  githubSourceContext?: TaskSourceContext | null
  inputRef?: React.RefObject<HTMLInputElement | null>
  onPlainEnter?: () => void
  disabled?: boolean
  disabledPlaceholder?: string
  textOnly?: boolean
  branchesEnabled?: boolean
  repoBackedSourcesDisabled?: boolean
  repoBackedSearchRepos?: readonly RepoOption[]
  allowCrossRepoProjectAdd?: boolean
  crossRepoSwitchTarget?: 'project' | 'task-source'
  onActiveSourceModeChange?: (mode: SmartNameMode) => void
}

export type NormalizedSmartWorkspaceNameFieldProps = Omit<
  SmartWorkspaceNameFieldProps,
  | 'disabled'
  | 'textOnly'
  | 'branchesEnabled'
  | 'repoBackedSourcesDisabled'
  | 'repoBackedSearchRepos'
  | 'allowCrossRepoProjectAdd'
  | 'crossRepoSwitchTarget'
> & {
  disabled: boolean
  textOnly: boolean
  branchesEnabled: boolean
  repoBackedSourcesDisabled: boolean
  repoBackedSearchRepos: readonly RepoOption[]
  allowCrossRepoProjectAdd: boolean
  crossRepoSwitchTarget: 'project' | 'task-source'
}

export type SmartWorkspaceNameSelection = {
  kind: 'github-pr' | 'github-issue' | 'gitlab-mr' | 'gitlab-issue' | 'branch'
  label: string
  url?: string
}

export type RowEntry = SmartWorkspaceSourceRow

export type RepoBackedSearchTarget = {
  repo: RepoOption
  githubSourceContext: TaskSourceContext | null
  gitlabSourceContext: TaskSourceContext | null
}

export type CrossRepoPrompt = {
  link: NonNullable<ReturnType<typeof parseGitHubIssueOrPRLink>>
  matchingRepo: RepoOption | null
}

export type RepoSlugTarget = {
  repo: RepoOption
  sourceContext: TaskSourceContext | null | undefined
}

export type SmartWorkspaceNameFieldSearchState = {
  debouncedQuery: string
  githubItems: GitHubWorkItem[]
  gitlabItems: GitLabWorkItem[]
  branches: BaseRefSearchResult[]
  branchResultsSource: { repoId: string; query: string } | null
}

export type CachedRepoSlug = RepoSlug
export const EMPTY_REPO_SEARCH_REPOS: readonly RepoOption[] = []
export const SEARCH_DEBOUNCE_MS = 200
export const RESULT_LIMIT = 12
