import { getIntlLocale } from '@/i18n/i18n'
import type { Automation, AutomationRun } from '../../../../shared/automations-types'
import type { TuiAgent } from '../../../../shared/tui-agent'
import { hostStableKey } from '../../../../shared/automation-owner-key'
import type { AutomationListRow } from './automation-list-row-identity'
import {
  getAutomationRowLastRunSnapshot,
  getLocalAutomationLastRunSnapshot,
  indexLatestAutomationRuns,
  type AutomationLastRunSnapshot
} from './automation-list-last-run'

export type AutomationListStatusFilter = 'all' | 'enabled' | 'paused'
export type AutomationListLastRunFilter = 'all' | 'failed' | 'succeeded' | 'never'
export type AutomationListSortField = 'name' | 'lastRun'
export type AutomationListSortDirection = 'asc' | 'desc'

export type AutomationListSort = {
  field: AutomationListSortField
  direction: AutomationListSortDirection
}

export type AutomationListViewItem = {
  kind: 'local'
  id: string
  name: string
  enabled: boolean
  lastRunAt: number | null
  lastRun: AutomationLastRunSnapshot
  agentId: TuiAgent
  automation: Automation
}

export type AutomationListFilter = {
  status: AutomationListStatusFilter
  lastRun: AutomationListLastRunFilter
  agentIds: readonly TuiAgent[]
  /** Catalog stable keys; empty (or absent, on older callers) means every host. */
  hostStableKeys?: readonly string[]
}

export const EMPTY_AUTOMATION_LIST_FILTER: AutomationListFilter = {
  status: 'all',
  lastRun: 'all',
  agentIds: [],
  hostStableKeys: []
}

function selectedHostKeys(filter: AutomationListFilter): readonly string[] {
  return filter.hostStableKeys ?? []
}

export function isAutomationListFilterActive(filter: AutomationListFilter): boolean {
  return (
    filter.status !== 'all' ||
    filter.lastRun !== 'all' ||
    filter.agentIds.length > 0 ||
    selectedHostKeys(filter).length > 0
  )
}

export function countAutomationListFilters(filter: AutomationListFilter): number {
  return (
    (filter.status !== 'all' ? 1 : 0) +
    (filter.lastRun !== 'all' ? 1 : 0) +
    (filter.agentIds.length > 0 ? 1 : 0) +
    (selectedHostKeys(filter).length > 0 ? 1 : 0)
  )
}

export function defaultAutomationListSortDirection(
  field: AutomationListSortField
): AutomationListSortDirection {
  return field === 'lastRun' ? 'desc' : 'asc'
}

export function nextAutomationListSort(
  current: AutomationListSort | null,
  field: AutomationListSortField
): AutomationListSort {
  if (current?.field !== field) {
    return { field, direction: defaultAutomationListSortDirection(field) }
  }
  return {
    field,
    direction: current.direction === 'asc' ? 'desc' : 'asc'
  }
}

function matchesStatusFilter(enabled: boolean, filter: AutomationListStatusFilter): boolean {
  if (filter === 'all') {
    return true
  }
  return filter === 'enabled' ? enabled : !enabled
}

function matchesLastRunFilter(
  snapshot: AutomationLastRunSnapshot,
  filter: AutomationListLastRunFilter
): boolean {
  if (filter === 'all') {
    return true
  }
  return snapshot.tone === filter
}

export function buildAutomationListViewItems({
  automations,
  runs
}: {
  automations: readonly Automation[]
  runs: readonly AutomationRun[]
}): AutomationListViewItem[] {
  const lastRunByAutomationId = indexLatestAutomationRuns(runs)
  const locals: AutomationListViewItem[] = automations.map((automation) => {
    const lastRun = getLocalAutomationLastRunSnapshot(
      automation,
      lastRunByAutomationId.get(automation.id)
    )
    return {
      kind: 'local',
      id: automation.id,
      name: automation.name,
      enabled: automation.enabled,
      lastRunAt: lastRun.at,
      lastRun,
      agentId: automation.agentId,
      automation
    }
  })
  return locals
}

/** A pre-catalog row names no host, so a host filter (which implies a hydrated catalog) excludes it. */
function matchesHostFilter(hostKey: string | null, keys: readonly string[]): boolean {
  return keys.length === 0 || (hostKey !== null && keys.includes(hostKey))
}

/** The attribute filter over catalog rows; identity-stable when the filter is inactive. */
export function filterAutomationListRows(
  rows: readonly AutomationListRow[],
  filter: AutomationListFilter
): readonly AutomationListRow[] {
  if (!isAutomationListFilterActive(filter)) {
    return rows
  }
  const hostKeys = selectedHostKeys(filter)
  return rows.filter(
    (row) =>
      matchesHostFilter(row.catalogRef ? hostStableKey(row.catalogRef) : null, hostKeys) &&
      matchesStatusFilter(row.automation.enabled, filter.status) &&
      matchesLastRunFilter(getAutomationRowLastRunSnapshot(row), filter.lastRun) &&
      (filter.agentIds.length === 0 || filter.agentIds.includes(row.automation.agentId))
  )
}

export function filterAutomationListViewItems(
  items: readonly AutomationListViewItem[],
  filter: AutomationListFilter
): AutomationListViewItem[] {
  if (!isAutomationListFilterActive(filter)) {
    return [...items]
  }
  return items.filter(
    (item) =>
      matchesStatusFilter(item.enabled, filter.status) &&
      matchesLastRunFilter(item.lastRun, filter.lastRun) &&
      (filter.agentIds.length === 0 || filter.agentIds.includes(item.agentId))
  )
}

export function sortAutomationListViewItems(
  items: readonly AutomationListViewItem[],
  sort: AutomationListSort | null
): AutomationListViewItem[] {
  if (!sort) {
    return [...items]
  }
  const next = [...items]
  const locale = getIntlLocale()
  next.sort((left, right) => {
    const compared =
      sort.field === 'name'
        ? left.name.localeCompare(right.name, locale, { sensitivity: 'base' })
        : (left.lastRunAt ?? 0) - (right.lastRunAt ?? 0)
    if (compared !== 0) {
      return sort.direction === 'asc' ? compared : -compared
    }
    return left.id.localeCompare(right.id)
  })
  return next
}

export function applyAutomationListView({
  automations,
  runs,
  filter,
  sort
}: {
  automations: readonly Automation[]
  runs: readonly AutomationRun[]
  filter: AutomationListFilter
  sort: AutomationListSort | null
}): AutomationListViewItem[] {
  return sortAutomationListViewItems(
    filterAutomationListViewItems(buildAutomationListViewItems({ automations, runs }), filter),
    sort
  )
}
