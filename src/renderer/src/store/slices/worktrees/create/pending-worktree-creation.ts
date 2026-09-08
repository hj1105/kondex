import type { WorktreeSlice } from '../../worktree-helpers'
import type { WorktreeSliceGet, WorktreeSliceSet } from '../listing/worktree-slice-types'

export function createBeginPendingWorktreeCreation(
  set: WorktreeSliceSet,
  _get: WorktreeSliceGet
): WorktreeSlice['beginPendingWorktreeCreation'] {
  return (entry) => {
    set((s) => ({
      pendingWorktreeCreations: { ...s.pendingWorktreeCreations, [entry.creationId]: entry },
      activePendingCreationId: entry.creationId
    }))
  }
}

export function createUpdatePendingWorktreeCreation(
  set: WorktreeSliceSet,
  _get: WorktreeSliceGet
): WorktreeSlice['updatePendingWorktreeCreation'] {
  return (creationId, patch) => {
    set((s) => {
      const entry = s.pendingWorktreeCreations[creationId]
      if (!entry) {
        return {}
      }
      // Why: the main process re-emits the same phase; skip no-op writes so the strip and panel don't re-render.
      const hasChange = (Object.keys(patch) as (keyof typeof patch)[]).some(
        (key) => patch[key] !== entry[key]
      )
      if (!hasChange) {
        return {}
      }
      return {
        pendingWorktreeCreations: {
          ...s.pendingWorktreeCreations,
          [creationId]: { ...entry, ...patch }
        }
      }
    })
  }
}

export function createRemovePendingWorktreeCreation(
  set: WorktreeSliceSet,
  _get: WorktreeSliceGet
): WorktreeSlice['removePendingWorktreeCreation'] {
  return (creationId) => {
    set((s) => {
      const entry = s.pendingWorktreeCreations[creationId]
      if (!entry) {
        return {}
      }
      const { [creationId]: _removed, ...rest } = s.pendingWorktreeCreations
      return {
        pendingWorktreeCreations: rest,
        // Why: only clear the active surface if it pointed here, so dismissing a background creation doesn't yank the user away.
        ...(s.activePendingCreationId === creationId ? { activePendingCreationId: null } : {})
      }
    })
  }
}

export function createSetActivePendingWorktreeCreation(
  set: WorktreeSliceSet,
  _get: WorktreeSliceGet
): WorktreeSlice['setActivePendingWorktreeCreation'] {
  return (creationId) => {
    set((s) => {
      if (creationId !== null && !s.pendingWorktreeCreations[creationId]) {
        return {}
      }
      return { activePendingCreationId: creationId }
    })
  }
}
