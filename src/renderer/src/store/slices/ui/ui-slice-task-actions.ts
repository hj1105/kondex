import type { UISlice, UISliceGet, UISliceSet } from './ui-slice-contract'
import { findPrevLiveNonTaskStackHistoryIndex } from '../worktree-nav-history'

export function createUiTaskActions(set: UISliceSet, get: UISliceGet): Partial<UISlice> {
  return {
    activeView: 'terminal',
    previousViewBeforeTasks: 'terminal',
    previousViewBeforeSettings: 'terminal',
    previousViewBeforeActivity: 'terminal',
    previousViewBeforeAutomations: 'terminal',
    previousViewBeforeSpace: 'terminal',
    previousViewBeforeSkills: 'terminal',
    setActiveView: (view) => set({ activeView: view }),
    newWorkspaceDraft: null,
    openTaskPage: () => {
      get().recordViewVisit('tasks')
      set((state) => ({
        activeView: 'tasks',
        previousViewBeforeTasks:
          state.activeView === 'tasks' ? state.previousViewBeforeTasks : state.activeView
      }))
    },
    closeTaskPage: () =>
      set((state) => {
        const currentEntry = state.worktreeNavHistory[state.worktreeNavHistoryIndex]
        let nextHistoryIndex = state.worktreeNavHistoryIndex
        if (currentEntry === 'tasks') {
          const prev = findPrevLiveNonTaskStackHistoryIndex(state)
          if (prev !== null) {
            nextHistoryIndex = prev
          }
        }
        return {
          activeView: state.previousViewBeforeTasks,
          worktreeNavHistoryIndex: nextHistoryIndex
        }
      })
  }
}
