import type { UISlice, UISliceGet, UISliceSet } from './ui-slice-contract'
import { rewindHistoryIndexPastView } from '../worktree-nav-history'

export function createUiViewActions(set: UISliceSet, get: UISliceGet): Partial<UISlice> {
  return {
    openActivityPage: () => {
      set((state) => ({
        activeView: 'activity',
        previousViewBeforeActivity:
          state.activeView === 'activity' ? state.previousViewBeforeActivity : state.activeView
      }))
    },
    closeActivityPage: () =>
      set((state) => ({
        activeView: state.previousViewBeforeActivity
      })),
    selectedAutomationId: null,
    setSelectedAutomationId: (id) => set({ selectedAutomationId: id }),
    pendingAutomationRunNavigation: null,
    setPendingAutomationRunNavigation: (navigation) =>
      set({ pendingAutomationRunNavigation: navigation }),
    openAutomationsPage: () => {
      get().recordViewVisit('automations')
      set((state) => ({
        activeView: 'automations',
        previousViewBeforeAutomations:
          state.activeView === 'automations'
            ? state.previousViewBeforeAutomations
            : state.activeView
      }))
    },
    closeAutomationsPage: () =>
      set((state) => ({
        activeView: state.previousViewBeforeAutomations,
        worktreeNavHistoryIndex: rewindHistoryIndexPastView(state, 'automations')
      })),
    openSpacePage: () => {
      set((state) => ({
        activeView: 'space',
        previousViewBeforeSpace:
          state.activeView === 'space' ? state.previousViewBeforeSpace : state.activeView
      }))
    },
    closeSpacePage: () =>
      set((state) => ({
        activeView: state.previousViewBeforeSpace
      })),
    openSkillsPage: () => {
      get().recordViewVisit('skills')
      set((state) => ({
        activeView: 'skills',
        previousViewBeforeSkills:
          state.activeView === 'skills' ? state.previousViewBeforeSkills : state.activeView
      }))
    },
    closeSkillsPage: () =>
      set((state) => ({
        activeView: state.previousViewBeforeSkills,
        worktreeNavHistoryIndex: rewindHistoryIndexPastView(state, 'skills')
      })),
    setNewWorkspaceDraft: (draft) => set({ newWorkspaceDraft: draft }),
    clearNewWorkspaceDraft: () => set({ newWorkspaceDraft: null })
  }
}
