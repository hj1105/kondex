import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '@/store'
import { getAllWorktreesFromState } from '@/store/selectors'
import { tabHasLivePty } from '@/lib/tab-has-live-pty'
import { persistWorktreeSortOrderByHost } from '@/lib/worktree-sort-order-persistence'
import type { Repo } from '../../../../../../shared/repo-types'
import type { Worktree } from '../../../../../../shared/worktree/types'
import {
  buildWorktreeComparator,
  buildWorktreeSortLabels,
  compareWorktreeSortLabel,
  type SortBy
} from '../../smart-sort'
import {
  buildAttentionByWorktree,
  hasFreshAttributedAgentStatus,
  type WorktreeAttention
} from '../../smart-attention'
import { useReusedArrayIdentity } from './use-reused-array-identity'

// Debounce re-sort after a sortEpoch bump so background score changes don't jar row positions.
const SORT_SETTLE_MS = 3_000

// Why debounce: scores are time-decaying, so recomputing on every sortEpoch bump makes worktrees jump; settle to coalesce.
// Structural changes (add/remove) bypass the debounce so a new worktree appears at its sorted position immediately.
function useDebouncedSortEpoch(worktreeCount: number, sortBy: SortBy): number {
  const sortEpoch = useAppStore((s) => s.sortEpoch)
  const [debouncedSortEpoch, setDebouncedSortEpoch] = useState(sortEpoch)
  const prevWorktreeCountRef = useRef(worktreeCount)
  useEffect(() => {
    if (debouncedSortEpoch === sortEpoch) {
      return
    }

    const structuralChange = worktreeCount !== prevWorktreeCountRef.current
    prevWorktreeCountRef.current = worktreeCount

    // Why: manual drag/drop is direct manipulation; the settle-window delay would make a successful drop look broken.
    if (structuralChange || sortBy === 'manual') {
      setDebouncedSortEpoch(sortEpoch)
      return
    }

    const timer = setTimeout(() => setDebouncedSortEpoch(sortEpoch), SORT_SETTLE_MS)
    return () => clearTimeout(timer)
  }, [sortEpoch, debouncedSortEpoch, worktreeCount, sortBy])
  return debouncedSortEpoch
}

// ── Stable sort order ──────────────────────────────────────────
// Why sortEpoch (not selection): selection side-effects (clearing isUnread, PR-cache refresh) must not reorder the sidebar under the user.
// Why useMemo not useEffect: order must be computed synchronously before the worktrees memo reads it.
export function useSidebarWorktreeSortOrder(args: {
  allWorktrees: readonly Worktree[]
  repoMap: Map<string, Repo>
  sortBy: SortBy
}): string[] {
  const { allWorktrees, repoMap, sortBy } = args
  // Non-archived count — detects structural changes (add/remove) so the debounce below can apply immediately.
  const worktreeCount = useMemo(() => {
    let count = 0
    for (const worktree of allWorktrees) {
      if (!worktree.isArchived) {
        count++
      }
    }
    return count
  }, [allWorktrees])
  const debouncedSortEpoch = useDebouncedSortEpoch(worktreeCount, sortBy)

  // Why a latching ref: a live signal makes Smart authoritative for the session, even after that activity ends.
  const sessionHasHadLiveSmartSignal = useRef(false)

  const recomputedSort = useMemo(() => {
    const state = useAppStore.getState()
    const nonArchivedWorktrees = getAllWorktreesFromState(state).filter(
      (worktree) => !worktree.isArchived
    )
    const now = Date.now()
    // Why precompute: the label tiebreaker runs on every comparison in every mode.
    const labels = buildWorktreeSortLabels(nonArchivedWorktrees)
    let detectedLiveSmartSignal = false

    // Why cold-start detection: agent-status hydrates async, so the warm comparator would collapse all to Class 4; keep the persisted order until a live signal appears.
    if (sortBy === 'smart' && !sessionHasHadLiveSmartSignal.current) {
      // Why tabHasLivePty over tab.ptyId: slept terminals keep tab.ptyId as a wake hint, so it'd falsely keep cold-start ordering off.
      const hasAnyLivePty = Object.values(state.tabsByWorktree).some((tabs) =>
        tabs.some((tab) => tabHasLivePty(state.ptyIdsByTabId, tab.id))
      )
      if (
        hasAnyLivePty ||
        hasFreshAttributedAgentStatus(state.agentStatusByPaneKey, now, state.tabsByWorktree)
      ) {
        detectedLiveSmartSignal = true
      } else {
        nonArchivedWorktrees.sort(
          (a, b) => b.sortOrder - a.sortOrder || compareWorktreeSortLabel(a, b, labels)
        )
        return {
          sortedIds: nonArchivedWorktrees.map((w) => w.id),
          attentionByWorktree: null,
          detectedLiveSmartSignal: false
        }
      }
    }

    // Why precompute: hot sort — build the attention map once so the O(N log N) comparator does O(1) lookups.
    const attentionByWorktree =
      sortBy === 'smart'
        ? buildAttentionByWorktree(
            nonArchivedWorktrees,
            state.tabsByWorktree,
            state.agentStatusByPaneKey,
            state.runtimePaneTitlesByTabId,
            state.ptyIdsByTabId,
            now,
            state.migrationUnsupportedByPtyId,
            state.terminalLayoutsByTabId
          )
        : new Map<string, WorktreeAttention>()
    nonArchivedWorktrees.sort(
      buildWorktreeComparator(sortBy, repoMap, now, attentionByWorktree, labels)
    )
    return {
      sortedIds: nonArchivedWorktrees.map((w) => w.id),
      attentionByWorktree: sortBy === 'smart' ? attentionByWorktree : null,
      detectedLiveSmartSignal
    }
    // debouncedSortEpoch is an intentional trigger not read in the memo; its change (debounced) signals a recompute.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSortEpoch, repoMap, sortBy])
  // Why: stable ID order prevents rank-only refreshes from echoing an unchanged snapshot.
  const sortedIds = useReusedArrayIdentity(recomputedSort.sortedIds)

  // Why after commit: a discarded render must not latch Smart onto a live signal that never committed.
  useEffect(() => {
    if (recomputedSort.detectedLiveSmartSignal) {
      sessionHasHadLiveSmartSignal.current = true
    }
  }, [recomputedSort.detectedLiveSmartSignal])

  // Why: only persist during live sessions so cold start reads the persisted order instead of overwriting it.
  useEffect(() => {
    if (sortBy !== 'smart' || sortedIds.length === 0 || !sessionHasHadLiveSmartSignal.current) {
      return
    }
    // Why: sortOrder lives in each host's worktreeMeta, so persist each host's ids on that host.
    persistWorktreeSortOrderByHost(useAppStore.getState(), sortedIds)
  }, [sortedIds, sortBy])

  return sortedIds
}
