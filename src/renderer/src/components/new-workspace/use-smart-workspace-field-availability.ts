import { useEffect } from 'react'
import type { ExecutionHostId } from '../../../../shared/execution-host'
import { getMrStateFilters, getSmartWorkspaceNameModes } from './smart-workspace-localized-options'
import {
  SEARCH_DEBOUNCE_MS,
  type NormalizedSmartWorkspaceNameFieldProps
} from './smart-workspace-name-field-model'
import { canUseGitLabSmartSource } from './smart-workspace-provider-availability'
import { useSmartWorkspaceFieldFocusControls } from './use-smart-workspace-field-focus-controls'
import type { useSmartWorkspaceNameFieldState } from './use-smart-workspace-name-field-state'

type FieldState = ReturnType<typeof useSmartWorkspaceNameFieldState>

export function useSmartWorkspaceFieldAvailability({
  props,
  state,
  repoBackedSearchTargets,
  preflightStatus,
  preflightStatusChecked,
  preflightStatusContextKey,
  expectedPreflightContextKey,
  refreshPreflightStatus
}: {
  props: NormalizedSmartWorkspaceNameFieldProps
  state: FieldState
  repoBackedSearchTargets: { gitlabSourceContext: { hostId?: ExecutionHostId | null } | null }[]
  preflightStatus: { glab?: { installed?: boolean } } | null
  preflightStatusChecked: boolean
  preflightStatusContextKey: string | null
  expectedPreflightContextKey: string
  refreshPreflightStatus: () => Promise<void>
}) {
  const {
    disabled,
    textOnly,
    repoBackedSourcesDisabled,
    branchesEnabled,
    onActiveSourceModeChange,
    value
  } = props
  const {
    mode,
    setMode,
    setOpen,
    setGithubItems,
    setGitlabItems,
    setBranches,
    setGithubLoading,
    setGitlabLoading,
    setBranchesLoading,
    setBranchResultsSource,
    setCrossRepoPrompt,
    setCommandValue,
    setDebouncedQuery
  } = state

  useEffect(() => onActiveSourceModeChange?.(mode), [mode, onActiveSourceModeChange])
  const preflightStatusCurrent = preflightStatusContextKey === expectedPreflightContextKey
  const localGitlabAvailable = preflightStatusCurrent && preflightStatus?.glab?.installed === true
  const gitlabSourceAvailable = repoBackedSearchTargets.some((target) =>
    canUseGitLabSmartSource({
      localGitlabAvailable,
      repoBackedSourcesDisabled,
      sourceHostId: target.gitlabSourceContext?.hostId
    })
  )
  const availableModes = getSmartWorkspaceNameModes().filter((item) => {
    if (textOnly) return item.id === 'text'
    if (item.id === 'github') return !repoBackedSourcesDisabled
    if (item.id === 'gitlab') return gitlabSourceAvailable
    if (item.id === 'branches') return branchesEnabled && !repoBackedSourcesDisabled
    return true
  })

  useEffect(() => {
    if (!availableModes.some((item) => item.id === mode)) setMode(availableModes[0]?.id ?? 'text')
  }, [availableModes, mode, setMode])

  useEffect(() => {
    if (!repoBackedSourcesDisabled) return
    setGithubItems([])
    setGitlabItems([])
    setBranches([])
    setGithubLoading(false)
    setGitlabLoading(false)
    setBranchesLoading(false)
    setBranchResultsSource(null)
    setCrossRepoPrompt(null)
  }, [
    repoBackedSourcesDisabled,
    setBranches,
    setBranchesLoading,
    setBranchResultsSource,
    setCrossRepoPrompt,
    setGithubItems,
    setGithubLoading,
    setGitlabItems,
    setGitlabLoading
  ])

  const focusControls = useSmartWorkspaceFieldFocusControls({ props, state })

  useEffect(() => {
    if (!disabled && !textOnly && (!preflightStatusChecked || !preflightStatusCurrent))
      void refreshPreflightStatus()
  }, [disabled, preflightStatusChecked, preflightStatusCurrent, refreshPreflightStatus, textOnly])

  useEffect(() => {
    if (textOnly) {
      if (mode !== 'text') setMode('text')
      setOpen(false)
    } else if (mode === 'gitlab' && !gitlabSourceAvailable) {
      setMode('smart')
      setGitlabItems([])
      setGitlabLoading(false)
      setCommandValue('')
    }
  }, [
    gitlabSourceAvailable,
    mode,
    setCommandValue,
    setGitlabItems,
    setGitlabLoading,
    setMode,
    setOpen,
    textOnly
  ])

  useEffect(() => {
    if (!disabled) return
    setOpen(false)
    setGithubItems([])
    setGitlabItems([])
    setBranches([])
    setBranchResultsSource(null)
    setGithubLoading(false)
    setGitlabLoading(false)
    setBranchesLoading(false)
    setCommandValue('')
    setCrossRepoPrompt(null)
  }, [
    disabled,
    setBranches,
    setBranchesLoading,
    setBranchResultsSource,
    setCommandValue,
    setCrossRepoPrompt,
    setGithubItems,
    setGithubLoading,
    setGitlabItems,
    setGitlabLoading,
    setOpen
  ])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(value), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [setDebouncedQuery, value])

  return {
    gitlabSourceAvailable,
    availableModes,
    mrStateFilters: getMrStateFilters(),
    ...focusControls
  }
}
