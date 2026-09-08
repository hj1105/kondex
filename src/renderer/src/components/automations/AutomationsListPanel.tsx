import React, { useRef } from 'react'
import { cn } from '@/lib/utils'
import type { AutomationRun } from '../../../../shared/automations-types'
import type { AutomationHostFilter } from '../../../../shared/automation-host-filter'
import type { SshConnectionState } from '../../../../shared/ssh-types'
import type { ProjectHostSetup } from '../../../../shared/project-types'
import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import type { RuntimeStatus } from '../../../../shared/runtime-types'
import type { TaskSourceHostAvailability } from '../task-source-context-summary'
import type { AutomationRowAction } from './automation-captured-owner'
import type { AutomationHostTarget } from './automation-host-client'
import {
  createAutomationListEnterHandler,
  getAutomationListArrowNavigationTarget,
  type AutomationListArrowKey
} from './automation-list-keyboard-navigation'
import type { AutomationListRow } from './automation-list-row-identity'
import { AutomationListFilterPills } from './AutomationListFilterMenu'
import { isAutomationListFilterActive, type AutomationListFilter } from './automation-list-view'
import { automationHostFilterStableKey } from '../../../../shared/automation-host-filter'
import type { AutomationTemplate } from './automation-templates'
import { AutomationListLocalRows } from './AutomationListLocalRows'
import { AutomationHostFilterNotice, AutomationHostLoadSummary } from './AutomationHostFilterNotice'
import { AutomationListEmptyView } from './AutomationListEmptyView'
import { resolveAutomationListEmptyState } from './automation-list-empty-state'
import type { AutomationListSearchCounts } from './use-automation-list-search'
import type { AutomationHostCatalogView } from './use-automation-host-catalog'
import type { AutomationHostRecoveryAction } from './automation-host-status-descriptors'
import type { AutomationHostCatalogEntry } from './automation-host-catalog-types'
import { useAutomationListFocusRecovery } from './use-automation-list-focus-recovery'
import { LIST_TABLE_CONTAINER_CLASS } from '@/lib/list-table-layout'
import { translate } from '@/i18n/i18n'
import { AutomationTemplateEmptyState } from './AutomationTemplateEmptyState'
import { AutomationListTableHeader } from './AutomationListTableHeader'
import { AutomationListToolbar } from './AutomationListToolbar'

const TEMPLATE_EMPTY_STATES: ReadonlySet<string> = new Set(['host-empty', 'all-hosts-empty'])
const EMPTY_AUTOMATION_RUNS: ReadonlyMap<string, AutomationRun> = new Map()

type AutomationsListPanelProps = {
  hasListItems: boolean
  hasFilteredListItems: boolean
  listSearchQuery: string
  isListSearchQueryTooLarge: boolean
  onListSearchQueryChange: (query: string) => void
  listFilter: AutomationListFilter
  onListFilterChange: (filter: AutomationListFilter) => void
  searchCounts: AutomationListSearchCounts
  hostCatalog: AutomationHostCatalogView
  onSelectHost: (filter: AutomationHostFilter) => void
  onRecoverHost: (
    action: AutomationHostRecoveryAction,
    entry?: AutomationHostCatalogEntry | null
  ) => void
  filteredRows: readonly AutomationListRow[]
  selectedRowKey: string | null
  relativeNow: number
  repoMap: ReadonlyMap<string, Repo>
  worktreeMap: ReadonlyMap<string, Worktree>
  repoForRow?: (row: AutomationListRow) => Repo | undefined
  worktreeForRow?: (row: AutomationListRow, repo: Repo | undefined) => Worktree | undefined
  projectHostSetups: readonly ProjectHostSetup[]
  sshConnectionStates: ReadonlyMap<string, Pick<SshConnectionState, 'status'>>
  runtimeStatusByEnvironmentId: ReadonlyMap<
    string,
    { status: RuntimeStatus | null; checkedAt: number }
  >
  hostTargetFor: (row: AutomationListRow) => AutomationHostTarget | null
  automationSourceHostAvailabilityByRowKey: ReadonlyMap<string, TaskSourceHostAvailability[]>
  hostLabelById?: ReadonlyMap<string, string>
  isActionEnabled: (row: AutomationListRow, action: AutomationRowAction) => boolean
  selectAutomationRow: (rowKey: string | null) => void
  runNow: (row: AutomationListRow) => void
  openEditDialog: (row: AutomationListRow) => void
  toggleAutomation: (row: AutomationListRow) => void
  requestDeleteAutomation: (row: AutomationListRow) => void
  openCreateDialog: (template?: AutomationTemplate) => void
  canCreateAutomation: boolean
  onOpenDetail: () => void
  onRefresh: () => void
  isRefreshing: boolean
  onOpenRuns: () => void
}

export function AutomationsListPanel(props: AutomationsListPanelProps): React.JSX.Element {
  const {
    hasListItems,
    hasFilteredListItems,
    listSearchQuery,
    isListSearchQueryTooLarge,
    onListSearchQueryChange,
    listFilter,
    onListFilterChange,
    searchCounts,
    hostCatalog,
    onSelectHost,
    onRecoverHost,
    filteredRows,
    selectedRowKey,
    relativeNow,
    repoMap,
    worktreeMap,
    repoForRow,
    worktreeForRow,
    projectHostSetups,
    sshConnectionStates,
    runtimeStatusByEnvironmentId,
    hostTargetFor,
    automationSourceHostAvailabilityByRowKey,
    hostLabelById,
    isActionEnabled,
    selectAutomationRow,
    runNow,
    openEditDialog,
    toggleAutomation,
    requestDeleteAutomation,
    openCreateDialog,
    canCreateAutomation,
    onOpenDetail,
    onRefresh,
    isRefreshing,
    onOpenRuns
  } = props
  const listRef = useRef<HTMLDivElement>(null)
  // Hosts moved into the Filters menu, so its toolbar row is the focus fallback now.
  const toolbarRef = useRef<HTMLDivElement>(null)
  const pendingKeyboardScrollRef = useRef(false)
  const rowKeys = React.useMemo(() => filteredRows.map((row) => row.key), [filteredRows])
  const visibleItems = React.useMemo(
    () => filteredRows.map((row) => ({ kind: 'local' as const, id: row.key })),
    [filteredRows]
  )
  useAutomationListFocusRecovery({ rowKeys, containerRef: listRef, fallbackRef: toolbarRef })
  const handleSearchArrowNavigate = React.useCallback(
    (key: AutomationListArrowKey) => {
      const next = getAutomationListArrowNavigationTarget({
        items: visibleItems,
        selectedId: selectedRowKey,
        key
      })
      if (!next) {
        return
      }
      const alreadySelected = selectedRowKey === next.id
      if (alreadySelected) {
        listRef.current
          ?.querySelector('[data-current="true"]')
          ?.scrollIntoView({ block: 'nearest' })
        return
      }
      pendingKeyboardScrollRef.current = true
      selectAutomationRow(next.id)
    },
    [selectAutomationRow, selectedRowKey, visibleItems]
  )
  const handleSearchEnter = createAutomationListEnterHandler({
    items: visibleItems,
    selectedId: selectedRowKey,
    selectAutomationRow,
    onOpenDetail
  })
  React.useEffect(() => {
    if (!pendingKeyboardScrollRef.current) {
      return
    }
    pendingKeyboardScrollRef.current = false
    listRef.current?.querySelector('[data-current="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [selectedRowKey])
  const listFilterActive = isAutomationListFilterActive(listFilter)
  // A leftover single-host query scope from before hosts moved into the Filters menu.
  const legacyScopeStableKey = automationHostFilterStableKey(hostCatalog.resolution.effective)
  const menuHostKeys = listFilter.hostStableKeys ?? []
  const selectedHostLabel =
    menuHostKeys.length > 0
      ? menuHostKeys
          .map(
            (stableKey) =>
              hostCatalog.entries.find((entry) => entry.stableKey === stableKey)?.label ?? stableKey
          )
          .join(', ')
      : legacyScopeStableKey === null
        ? null
        : (hostCatalog.resolution.entry?.label ??
          translate('auto.components.automations.hostPicker.loadingHost', 'Loading host…'))
  const emptyStateInput = {
    resolution: hostCatalog.resolution,
    ...searchCounts,
    filterActive: listFilterActive
  }
  const emptyState = resolveAutomationListEmptyState(emptyStateInput)
  const rowProps = {
    selectedRowKey,
    isSelectedLocal: true,
    lastRunByAutomationId: EMPTY_AUTOMATION_RUNS,
    relativeNow,
    repoMap,
    worktreeMap,
    repoForRow,
    worktreeForRow,
    projectHostSetups,
    sshConnectionStates,
    runtimeStatusByEnvironmentId,
    hostTargetFor,
    automationSourceHostAvailabilityByRowKey,
    hostLabelById,
    isActionEnabled,
    onSelect: (rowKey: string) => {
      selectAutomationRow(rowKey)
      onOpenDetail()
    },
    onRunNow: runNow,
    onEdit: openEditDialog,
    onToggle: toggleAutomation,
    onDelete: requestDeleteAutomation
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-4 md:px-5">
      <AutomationListToolbar
        toolbarRef={toolbarRef}
        listSearchQuery={listSearchQuery}
        isListSearchQueryTooLarge={isListSearchQueryTooLarge}
        onListSearchQueryChange={onListSearchQueryChange}
        onSearchArrowNavigate={handleSearchArrowNavigate}
        onSearchEnter={handleSearchEnter}
        listFilter={listFilter}
        onListFilterChange={onListFilterChange}
        hostEntries={hostCatalog.entries}
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
        onOpenRuns={onOpenRuns}
        openCreateDialog={openCreateDialog}
        canCreateAutomation={canCreateAutomation}
      />

      {listFilterActive || legacyScopeStableKey !== null ? (
        <div className="flex flex-wrap items-center gap-1.5 pb-3">
          <AutomationListFilterPills
            filter={listFilter}
            onChange={onListFilterChange}
            hostLabel={selectedHostLabel}
            onClearHost={() => {
              onListFilterChange({ ...listFilter, hostStableKeys: [] })
              onSelectHost({ kind: 'all' })
            }}
          />
        </div>
      ) : null}
      <AutomationHostFilterNotice
        resolution={hostCatalog.resolution}
        onRecover={(action) => onRecoverHost(action)}
        className="mb-2"
      />
      <AutomationHostLoadSummary {...hostCatalog.loadCounts} />
      <div
        ref={listRef}
        className={cn('scrollbar-sleek min-h-0 flex-1 overflow-auto', LIST_TABLE_CONTAINER_CLASS)}
      >
        {hasFilteredListItems ? (
          <div className="min-w-full w-fit">
            <AutomationListTableHeader />
            <div className="divide-y divide-border/50">
              <AutomationListLocalRows {...rowProps} rows={filteredRows} />
            </div>
          </div>
        ) : (
          <AutomationListEmptyView
            {...emptyStateInput}
            onRecover={(action) => onRecoverHost(action)}
          />
        )}

        {!hasListItems && TEMPLATE_EMPTY_STATES.has(emptyState.kind) ? (
          <AutomationTemplateEmptyState onOpenCreate={openCreateDialog} />
        ) : null}
      </div>
    </section>
  )
}
