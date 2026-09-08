import { useCallback, useMemo } from 'react'
import { getWorktreePathBasenameFromId } from '../../../../shared/worktree/id'
import { filterAutomationListRows } from './automation-list-view'
import { unscopedAutomationListRows } from './automation-list-row-identity'
import { useAutomationHostCatalog } from './use-automation-host-catalog'
import { useAutomationListSearch } from './use-automation-list-search'
import type { AutomationsPageLocalState } from './use-automations-page-local-state'
import type { AutomationsPageStoreState } from './use-automations-page-store-state'

/** Host-qualified rows, external scopes, selection, and list-search projection. */
export function useAutomationsPageListState({
  store,
  local
}: {
  store: AutomationsPageStoreState
  local: AutomationsPageLocalState
}) {
  const { repoMap, worktreeMap, repoForRow, worktreeForRow, selectedId, setSelectedId } = store
  const {
    automations,
    failedAuthorityKeys,
    listSearchQuery,
    listFilter,
    selectedRowKey,
    selectedAutomationRuns,
    workspaceNameCacheRef,
    setSelectedAutomationRunPageId,
    setSelectedRowKey
  } = local
  const hostCatalog = useAutomationHostCatalog({ failedAuthorityKeys })
  const unscopedRows = useMemo(() => unscopedAutomationListRows(automations), [automations])
  const visibleRows = hostCatalog.rows.answered ? hostCatalog.rows.rows : unscopedRows
  const capturedAutomationOwners = hostCatalog.rows.capturedOwners
  const attributeFilteredRows = useMemo(
    () => filterAutomationListRows(visibleRows, listFilter),
    [listFilter, visibleRows]
  )
  const selectAutomationRow = useCallback(
    (rowKey: string | null): void => {
      const row = rowKey === null ? null : visibleRows.find((candidate) => candidate.key === rowKey)
      setSelectedAutomationRunPageId(null)
      setSelectedRowKey(row?.key ?? null)
      setSelectedId(row?.automation.id ?? null)
    },
    [setSelectedAutomationRunPageId, setSelectedId, setSelectedRowKey, visibleRows]
  )
  const selectedRow = selectedId
    ? (visibleRows.find((row) => row.key === selectedRowKey && row.automation.id === selectedId) ??
      visibleRows.find((row) => row.automation.id === selectedId) ??
      null)
    : (visibleRows[0] ?? null)
  const selected = selectedRow?.automation ?? null
  const {
    isListSearchQueryTooLarge,
    filteredRows,
    hasListItems,
    hasFilteredListItems,
    searchCounts
  } = useAutomationListSearch({
    listSearchQuery,
    rows: attributeFilteredRows,
    repoMap,
    worktreeMap,
    selectedRowKey: selectedRow?.key ?? null,
    selectAutomationRow
  })
  const selectedAutomationRunsWithWorkspaceNames = useMemo(
    () =>
      selectedAutomationRuns.runs.map((run) => {
        if (!run.workspaceId || run.workspaceDisplayName?.trim()) {
          return run
        }
        const displayName =
          (selectedRow
            ? worktreeForRow(selectedRow, repoForRow(selectedRow), run.workspaceId)?.displayName
            : worktreeMap.get(run.workspaceId)?.displayName) ??
          workspaceNameCacheRef.current.get(run.workspaceId) ??
          getWorktreePathBasenameFromId(run.workspaceId)
        const trimmedDisplayName = displayName?.trim()
        return trimmedDisplayName ? { ...run, workspaceDisplayName: trimmedDisplayName } : run
      }),
    [
      repoForRow,
      selectedAutomationRuns.runs,
      selectedRow,
      worktreeForRow,
      worktreeMap,
      workspaceNameCacheRef
    ]
  )
  return {
    hostCatalog,
    unscopedRows,
    visibleRows,
    capturedAutomationOwners,
    selectedRow,
    selected,
    selectedAutomationRunsWithWorkspaceNames,
    isListSearchQueryTooLarge,
    filteredRows,
    hasListItems,
    hasFilteredListItems,
    searchCounts,
    selectAutomationRow
  }
}

export type AutomationsPageListState = ReturnType<typeof useAutomationsPageListState>
