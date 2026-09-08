import type { UISlice, UISliceGet, UISliceSet } from './ui-slice-contract'

export function createUiSurfaceActions(set: UISliceSet, _get: UISliceGet): Partial<UISlice> {
  return {
    workspacePortScan: null,
    workspacePortScansByKey: {},
    workspacePortScanRefreshing: false,
    setWorkspacePortScan: (scan) =>
      set((state) => {
        if (!scan) {
          if (!state.workspacePortScan && Object.keys(state.workspacePortScansByKey).length === 0) {
            return state
          }
          return { workspacePortScan: null, workspacePortScansByKey: {} }
        }
        if (
          state.workspacePortScan?.key === scan.key &&
          state.workspacePortScan.result === scan.result &&
          state.workspacePortScansByKey[scan.key] === scan.result
        ) {
          return state
        }
        return {
          workspacePortScan: scan,
          workspacePortScansByKey: { ...state.workspacePortScansByKey, [scan.key]: scan.result }
        }
      }),
    // Why: target changes rebuild the aggregate without republishing or clearing per-host scans.
    setWorkspacePortScanProjection: (scan) =>
      set((state) => {
        if (
          state.workspacePortScan?.key === scan?.key &&
          state.workspacePortScan?.result === scan?.result
        ) {
          return state
        }
        return { workspacePortScan: scan }
      }),
    // Why: drop stale per-host scans in one store update so a large host set can't fan out notifications to every subscriber.
    replaceWorkspacePortScans: (scansByKey, projection) =>
      set((state) => {
        if (
          state.workspacePortScansByKey === scansByKey &&
          state.workspacePortScan?.key === projection?.key &&
          state.workspacePortScan?.result === projection?.result
        ) {
          return state
        }
        return { workspacePortScansByKey: scansByKey, workspacePortScan: projection }
      }),
    setWorkspacePortScanForKey: (key, result) =>
      set((state) => {
        const currentResult = state.workspacePortScansByKey[key]
        if (currentResult === result || (!result && !currentResult)) {
          return state
        }
        const nextScansByKey = { ...state.workspacePortScansByKey }
        if (result) {
          nextScansByKey[key] = result
        } else {
          delete nextScansByKey[key]
        }
        return {
          workspacePortScansByKey: nextScansByKey,
          workspacePortScan:
            state.workspacePortScan?.key === key
              ? result
                ? { key, result }
                : null
              : state.workspacePortScan
        }
      }),
    setWorkspacePortScanRefreshing: (refreshing) =>
      set({ workspacePortScanRefreshing: refreshing }),

    pendingRevealWorktree: null,
    pendingRevealSidebarRow: null,
    // Why sidebarBody here: the worktree list (and its reveal consumer) is unmounted while the
    // Agents body is showing, so a reveal that does not switch bodies silently no-ops.
    revealWorktreeInSidebar: (worktreeId, options) =>
      set({
        sidebarBody: 'workspaces',
        pendingRevealWorktree: {
          worktreeId,
          ...(options?.executionHostId ? { executionHostId: options.executionHostId } : {}),
          behavior: options?.behavior ?? 'smooth',
          ...(options?.highlight ? { highlight: true } : {}),
          ...(options?.beginRename ? { beginRename: true } : {})
        }
      }),
    revealSidebarRow: (rowKey, options) =>
      set({
        sidebarBody: 'workspaces',
        pendingRevealSidebarRow: {
          rowKey,
          behavior: options?.behavior ?? 'smooth',
          ...(options?.highlight === false ? {} : { highlight: true })
        }
      }),
    clearPendingRevealWorktreeId: () => set({ pendingRevealWorktree: null }),
    clearPendingRevealSidebarRow: () => set({ pendingRevealSidebarRow: null }),
    scrollToDiffCommentId: null,
    setScrollToDiffCommentId: (id) => set({ scrollToDiffCommentId: id })
  }
}
