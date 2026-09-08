import { useDeferredValue, useEffect, useMemo, useRef } from 'react'
import type { Repo } from '../../../../shared/repo-types'
import { resolveAutomationListSearchQuery } from './automation-list-search'
import type { AutomationListRow } from './automation-list-row-identity'
import {
  buildAutomationListSearchRowFingerprint,
  buildAutomationListSearchRows,
  buildAutomationSearchRowSources,
  matchAutomationListSearchRowKeys,
  type AutomationListSearchRow,
  type AutomationListSearchRowSource,
  type AutomationWorkspaceNameLookup
} from './automation-list-search-rows'

/** Counts the empty-state view consumes, so it never recomputes what search already knows. */
export type AutomationListSearchCounts = {
  hostRowCount: number
  visibleRowCount: number
  searchActive: boolean
}

/**
 * Rebuilds indexes only when the fingerprint changes, so a refresh tick that
 * replaces arrays with equal search content re-renders without re-indexing.
 * The cache is keyed by fingerprint rather than array identity, which useMemo
 * cannot express on its own.
 */
function useAutomationSearchRows(
  sources: AutomationListSearchRowSource[]
): AutomationListSearchRow[] {
  const fingerprint = useMemo(() => buildAutomationListSearchRowFingerprint(sources), [sources])
  const cacheRef = useRef<{ fingerprint: string; rows: AutomationListSearchRow[] } | null>(null)
  if (!cacheRef.current || cacheRef.current.fingerprint !== fingerprint) {
    cacheRef.current = { fingerprint, rows: buildAutomationListSearchRows(sources) }
  }
  return cacheRef.current.rows
}

export function useAutomationListSearch({
  listSearchQuery,
  rows,
  repoMap,
  worktreeMap,
  selectedRowKey,
  selectAutomationRow
}: {
  listSearchQuery: string
  rows: readonly AutomationListRow[]
  repoMap: ReadonlyMap<string, Repo>
  worktreeMap?: AutomationWorkspaceNameLookup
  /** The row currently on screen, not the bare id: two hosts can hold that id. */
  selectedRowKey: string | null
  selectAutomationRow: (rowKey: string | null) => void
}): {
  isListSearchQueryTooLarge: boolean
  filteredRows: readonly AutomationListRow[]
  hasListItems: boolean
  hasFilteredListItems: boolean
  searchCounts: AutomationListSearchCounts
} {
  // Why: keep the input snappy; matching is deferred so caret never waits on
  // index scans. Only the normalized active query can fire a search.
  const deferredListSearchQuery = useDeferredValue(listSearchQuery)
  const liveListSearchResolution = useMemo(
    () => resolveAutomationListSearchQuery(listSearchQuery),
    [listSearchQuery]
  )
  const deferredListSearchResolution = useMemo(
    () => resolveAutomationListSearchQuery(deferredListSearchQuery),
    [deferredListSearchQuery]
  )
  // Why: field feedback tracks the live value so a huge paste is labeled
  // immediately; list filtering stays on the deferred resolution.
  const isListSearchQueryTooLarge = liveListSearchResolution.status === 'too_large'
  // Why: null means search must not run (empty, whitespace, or too large).
  const activeListSearchQuery =
    deferredListSearchResolution.status === 'active' ? deferredListSearchResolution.query : null
  const isListSearchActive = activeListSearchQuery !== null

  const automationSearchSources = useMemo(
    () => buildAutomationSearchRowSources(rows, { repoMap, worktreeMap }),
    [rows, repoMap, worktreeMap]
  )
  const automationSearchRows = useAutomationSearchRows(automationSearchSources)

  // Why: matching runs only when the normalized query or search content changes —
  // never on relativeNow / nextRunAt / usage refresh alone.
  const filteredRowKeys = useMemo(
    (): readonly string[] | null =>
      activeListSearchQuery === null
        ? null
        : matchAutomationListSearchRowKeys(automationSearchRows, activeListSearchQuery),
    [activeListSearchQuery, automationSearchRows]
  )

  const filteredRows = useMemo((): readonly AutomationListRow[] => {
    if (filteredRowKeys === null) {
      return rows
    }
    if (filteredRowKeys.length === 0) {
      return []
    }
    // Keyed by row, not automation id: a bare-id map holds one entry for two
    // hosts' copies, so one host's row would be dropped and the other doubled.
    const byKey = new Map(rows.map((row) => [row.key, row]))
    const next: AutomationListRow[] = []
    for (const key of filteredRowKeys) {
      const row = byKey.get(key)
      if (row) {
        next.push(row)
      }
    }
    return next
  }, [rows, filteredRowKeys])

  const hostRowCount = rows.length
  const visibleRowCount = filteredRows.length

  // Why: when search hides the current row, move selection to the first visible
  // match so list highlight and detail stay aligned. No matches → keep detail.
  useEffect(() => {
    if (activeListSearchQuery === null) {
      return
    }
    const localVisible =
      selectedRowKey != null && filteredRows.some((row) => row.key === selectedRowKey)
    if (localVisible) {
      return
    }
    const firstLocal = filteredRows[0]
    if (firstLocal) {
      if (selectedRowKey !== firstLocal.key) {
        selectAutomationRow(firstLocal.key)
      }
    }
  }, [activeListSearchQuery, filteredRows, selectAutomationRow, selectedRowKey])

  return {
    isListSearchQueryTooLarge,
    filteredRows,
    hasListItems: hostRowCount > 0,
    hasFilteredListItems: visibleRowCount > 0,
    // Why: the empty-state view reads rows-before and rows-after from here
    // rather than recomputing either count from its own props.
    searchCounts: { hostRowCount, visibleRowCount, searchActive: isListSearchActive }
  }
}
