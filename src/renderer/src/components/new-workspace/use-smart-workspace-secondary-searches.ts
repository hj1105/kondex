import { useEffect, useMemo } from 'react'
import { searchRuntimeRepoBaseRefDetails } from '@/runtime/runtime-repo-client'
import { RESULT_LIMIT } from './smart-workspace-name-field-model'
import { getBranchSearchRequest } from './smart-workspace-source-results'
import type { useSmartWorkspaceNameFieldFoundation } from './use-smart-workspace-name-field-foundation'

type Foundation = ReturnType<typeof useSmartWorkspaceNameFieldFoundation>

export function useSmartWorkspaceSecondarySearches({
  foundation
}: {
  foundation: Foundation
}): void {
  const {
    disabled,
    branchesEnabled,
    repoBackedSourcesDisabled,
    textOnly,
    mode,
    selectedRepo,
    debouncedQuery,
    selectedRepoOwnerSettings,
    setBranches,
    setBranchResultsSource,
    setBranchesLoading
  } = foundation
  const branchSearchRequest = useMemo(
    () =>
      getBranchSearchRequest({
        disabled,
        branchesEnabled: branchesEnabled && !repoBackedSourcesDisabled,
        textOnly,
        mode,
        selectedRepoId: selectedRepo?.id ?? null,
        query: debouncedQuery,
        limit: RESULT_LIMIT
      }),
    [
      branchesEnabled,
      debouncedQuery,
      disabled,
      mode,
      repoBackedSourcesDisabled,
      selectedRepo?.id,
      textOnly
    ]
  )

  useEffect(() => {
    if (!branchSearchRequest) {
      setBranches([])
      setBranchResultsSource(null)
      setBranchesLoading(false)
      return
    }
    let stale = false
    setBranchesLoading(true)
    void searchRuntimeRepoBaseRefDetails(
      selectedRepoOwnerSettings,
      branchSearchRequest.repoId,
      branchSearchRequest.query,
      branchSearchRequest.limit
    )
      .then((results) => {
        if (!stale) {
          setBranches(results)
          setBranchResultsSource({
            repoId: branchSearchRequest.repoId,
            query: branchSearchRequest.query
          })
        }
      })
      .catch(() => {
        if (!stale) {
          setBranches([])
          setBranchResultsSource(null)
        }
      })
      .finally(() => {
        if (!stale) setBranchesLoading(false)
      })
    return () => {
      stale = true
    }
  }, [
    branchSearchRequest,
    selectedRepoOwnerSettings,
    setBranches,
    setBranchResultsSource,
    setBranchesLoading
  ])
}
