import type { AppState } from '../../store/types'

type NewWorkspaceShortcutModalData = {
  telemetrySource: 'shortcut'
}

export function buildNewWorkspaceShortcutModalData(
  _state: Pick<AppState, 'activeView'>
): NewWorkspaceShortcutModalData {
  return { telemetrySource: 'shortcut' }
}

export function openNewWorkspaceFromShortcut(
  state: Pick<AppState, 'activeModal' | 'activeView' | 'openModal'>
): void {
  if (state.activeModal === 'new-workspace-composer') {
    return
  }
  state.openModal('new-workspace-composer', buildNewWorkspaceShortcutModalData(state))
}
