import { useEffect, useMemo } from 'react'
import { CaseSensitive, LoaderCircle, Search } from 'lucide-react'
import { parseGitHubIssueOrPRLink } from '@/lib/github-links'
import { parseGitLabIssueOrMRLink } from '@/lib/gitlab-links'
import {
  getActiveWorkspaceEmojiShortcode,
  searchWorkspaceEmojiShortcodes,
  type WorkspaceEmojiSuggestion
} from '@/lib/workspace-emoji-shortcodes'
import { resolveSmartWorkspaceCommandValue } from './smart-workspace-command-value'
import {
  buildSmartWorkspaceSourceRows,
  getVisibleBranchResults,
  getVisibleHeldProviderResults,
  isBlockingTaskUrlResolution,
  isSmartWorkspaceSourceQueryWithinLimit
} from './smart-workspace-source-results'
import { RESULT_LIMIT, type RowEntry } from './smart-workspace-name-field-model'
import type { useSmartWorkspaceNameFieldFoundation } from './use-smart-workspace-name-field-foundation'

type Foundation = ReturnType<typeof useSmartWorkspaceNameFieldFoundation>
const isTypedTextSourceRow = (row: RowEntry): boolean =>
  row.kind === 'use-name' || row.kind === 'create-branch'

export function useSmartWorkspaceNameFieldPresentation(foundation: Foundation) {
  const {
    branches,
    mode,
    branchResultsSource,
    selectedRepo,
    value,
    githubItems,
    debouncedQuery,
    gitlabSourceAvailable,
    gitlabItems,
    commandValue,
    setCommandValue,
    emojiCursor,
    disabled,
    selectedSource,
    emojiCommandValue,
    githubLoading,
    gitlabLoading,
    branchesLoading
  } = foundation
  const githubUrlIntent = useMemo(
    () =>
      isSmartWorkspaceSourceQueryWithinLimit(value) && (mode === 'smart' || mode === 'github')
        ? parseGitHubIssueOrPRLink(value)
        : null,
    [mode, value]
  )
  const gitlabUrlIntent = useMemo(
    () =>
      isSmartWorkspaceSourceQueryWithinLimit(value) && (mode === 'smart' || mode === 'gitlab')
        ? parseGitLabIssueOrMRLink(value)
        : null,
    [mode, value]
  )
  const rows = useMemo<RowEntry[]>(
    () =>
      buildSmartWorkspaceSourceRows({
        branches: getVisibleBranchResults({
          branches,
          mode,
          resultRepoId: branchResultsSource?.repoId ?? null,
          resultQuery: branchResultsSource?.query ?? null,
          selectedRepoId: selectedRepo?.id ?? null,
          value
        }),
        githubItems: getVisibleHeldProviderResults({ items: githubItems, value, debouncedQuery }),
        gitlabAvailable: gitlabSourceAvailable,
        gitlabItems: getVisibleHeldProviderResults({ items: gitlabItems, value, debouncedQuery }),
        githubUrlIntent,
        gitlabUrlIntent,
        mode,
        resultLimit: RESULT_LIMIT,
        value
      }),
    [
      branches,
      branchResultsSource,
      debouncedQuery,
      githubItems,
      githubUrlIntent,
      gitlabSourceAvailable,
      gitlabItems,
      gitlabUrlIntent,
      mode,
      selectedRepo?.id,
      value
    ]
  )
  const { typedTextActionRow, searchResultRows } = useMemo(() => {
    const typedTextRow = rows.find(isTypedTextSourceRow) ?? null
    return {
      typedTextActionRow: typedTextRow,
      searchResultRows: typedTextRow ? rows.filter((row) => row !== typedTextRow) : rows
    }
  }, [rows])
  const trimmedValue = isSmartWorkspaceSourceQueryWithinLimit(value) ? value.trim() : ''
  const trimmedDebouncedQuery = isSmartWorkspaceSourceQueryWithinLimit(debouncedQuery)
    ? debouncedQuery.trim()
    : ''
  const isQueryStale = trimmedValue.length > 0 && trimmedDebouncedQuery !== trimmedValue
  const sourceIntent = useMemo<'github' | 'gitlab' | null>(() => {
    if (!isSmartWorkspaceSourceQueryWithinLimit(value) || !value.trim()) {
      return null
    }
    if (/^#\d+$/.test(value.trim()) || parseGitHubIssueOrPRLink(value.trim()) !== null) {
      return 'github'
    }
    if (parseGitLabIssueOrMRLink(value.trim()) !== null) {
      return 'gitlab'
    }
    return null
  }, [value])
  const blockingTaskUrlResolution = isBlockingTaskUrlResolution({
    sourceIntent,
    isQueryStale,
    githubLoading,
    gitlabLoading
  })
  const resolvedCommandValue = resolveSmartWorkspaceCommandValue({
    currentValue: commandValue,
    rows,
    isQueryStale,
    sourceIntent
  })
  useEffect(() => {
    if (commandValue !== resolvedCommandValue) {
      setCommandValue(resolvedCommandValue)
    }
  }, [commandValue, resolvedCommandValue, setCommandValue])
  const activeEmojiShortcode = useMemo(
    () => getActiveWorkspaceEmojiShortcode(value, emojiCursor),
    [emojiCursor, value]
  )
  const emojiSuggestions = useMemo(
    () =>
      activeEmojiShortcode
        ? searchWorkspaceEmojiShortcodes(activeEmojiShortcode.query)
        : ([] as WorkspaceEmojiSuggestion[]),
    [activeEmojiShortcode]
  )
  const emojiMenuOpen =
    !disabled &&
    selectedSource === null &&
    activeEmojiShortcode !== null &&
    emojiSuggestions.length > 0
  const resolvedEmojiCommandValue = emojiSuggestions.some(
    (suggestion) => `emoji:${suggestion.shortcode}` === emojiCommandValue
  )
    ? emojiCommandValue
    : emojiSuggestions[0]
      ? `emoji:${emojiSuggestions[0].shortcode}`
      : ''
  const selectedEmojiSuggestion =
    emojiSuggestions.find(
      (suggestion) => `emoji:${suggestion.shortcode}` === resolvedEmojiCommandValue
    ) ?? null
  const loading = githubLoading || gitlabLoading || branchesLoading
  const showSearchSpinner = loading && searchResultRows.length === 0
  const ActiveInputIcon =
    mode === 'text' ? CaseSensitive : showSearchSpinner ? LoaderCircle : Search
  return {
    rows,
    typedTextActionRow,
    searchResultRows,
    isQueryStale,
    resolvedCommandValue,
    activeEmojiShortcode,
    emojiSuggestions,
    emojiMenuOpen,
    resolvedEmojiCommandValue,
    selectedEmojiSuggestion,
    loading,
    showSearchSpinner,
    blockingTaskUrlResolution,
    ActiveInputIcon
  }
}
