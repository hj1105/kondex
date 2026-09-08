import React from 'react'
import type { AutomationsPageController } from './use-automations-page-controller'
import { AutomationsListPanel } from './AutomationsListPanel'

export function AutomationsPageListPanel({
  controller,
  onOpenDetail
}: {
  controller: AutomationsPageController
  onOpenDetail: () => void
}): React.JSX.Element {
  const {
    store,
    local,
    list,
    destination,
    sourceAvailability,
    pageRefresh,
    runActions,
    editorActions,
    managementActions,
    presentation
  } = controller
  const {
    projectHostSetups,
    repoMap,
    worktreeMap,
    sshConnectionStates,
    runtimeStatusByEnvironmentId
  } = store
  const {
    listSearchQuery,
    setListSearchQuery,
    listFilter,
    setListFilter,
    relativeNow,
    isLoading,
    setPageView
  } = local
  const {
    hostCatalog,
    hasListItems,
    hasFilteredListItems,
    isListSearchQueryTooLarge,
    filteredRows,
    selectedRow,
    searchCounts
  } = list
  const onListFilterChange = (next: typeof listFilter): void => {
    setListFilter(next)
    if ((next.hostStableKeys?.length ?? 0) > 0 && hostCatalog.resolution.effective.kind !== 'all') {
      hostCatalog.selectHost({ kind: 'all' })
    }
  }
  return (
    <AutomationsListPanel
      hasListItems={hasListItems}
      hasFilteredListItems={hasFilteredListItems}
      listSearchQuery={listSearchQuery}
      isListSearchQueryTooLarge={isListSearchQueryTooLarge}
      onListSearchQueryChange={setListSearchQuery}
      listFilter={listFilter}
      onListFilterChange={onListFilterChange}
      searchCounts={{
        ...searchCounts,
        hostRowCount: list.visibleRows.length
      }}
      hostCatalog={hostCatalog}
      onSelectHost={hostCatalog.selectHost}
      onRecoverHost={(action, entry) => {
        hostCatalog.recover(action, entry)
        if (action === 'retry') {
          void pageRefresh.refresh()
        }
      }}
      filteredRows={filteredRows}
      selectedRowKey={selectedRow?.key ?? null}
      relativeNow={relativeNow}
      repoMap={repoMap}
      worktreeMap={worktreeMap}
      repoForRow={store.repoForRow}
      worktreeForRow={store.worktreeForRow}
      projectHostSetups={projectHostSetups}
      sshConnectionStates={sshConnectionStates}
      runtimeStatusByEnvironmentId={runtimeStatusByEnvironmentId}
      hostTargetFor={destination.automationHostTargetFor}
      automationSourceHostAvailabilityByRowKey={
        sourceAvailability.automationSourceHostAvailabilityByRowKey
      }
      hostLabelById={presentation.hostLabelById}
      isActionEnabled={destination.isAutomationRowActionEnabled}
      selectAutomationRow={list.selectAutomationRow}
      runNow={(row) => void runActions.runNow(row)}
      openEditDialog={(row) => void editorActions.openEditDialog(row)}
      toggleAutomation={(row) => void managementActions.toggleAutomation(row)}
      requestDeleteAutomation={managementActions.requestDeleteAutomation}
      openCreateDialog={editorActions.openCreateDialog}
      canCreateAutomation={destination.canCreateAutomation}
      onOpenDetail={onOpenDetail}
      onRefresh={() => {
        hostCatalog.refreshHosts()
        void pageRefresh.refresh()
      }}
      isRefreshing={isLoading}
      onOpenRuns={() => {
        hostCatalog.selectHost({ kind: 'all' })
        setPageView('runs')
      }}
    />
  )
}
