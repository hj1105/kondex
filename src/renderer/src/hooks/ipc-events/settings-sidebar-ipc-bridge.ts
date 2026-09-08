import { canShowRightSidebarForView } from '@/lib/right-sidebar-visibility'
import { showTerminalShortcutCaptureNotification } from '@/lib/terminal-shortcut-capture-notification'
import { TOGGLE_FLOATING_TERMINAL_EVENT } from '@/lib/floating-terminal'
import { useAppStore } from '../../store'

function getShortcutPlatform(): NodeJS.Platform {
  if (navigator.userAgent.includes('Mac')) {
    return 'darwin'
  }
  if (navigator.userAgent.includes('Windows')) {
    return 'win32'
  }
  return 'linux'
}

export function registerSettingsAndSidebarIpcBridge(unsubs: (() => void)[]): void {
  unsubs.push(
    window.api.ui.onOpenSettings(() => {
      useAppStore.getState().openSettingsPage()
    })
  )

  // Why: a tray "Settings…" click can fire before this attaches; consume any queued intent (?. guards stale preload).
  void window.api.ui
    .consumePendingOpenSettings?.()
    .then((open) => {
      if (open) {
        useAppStore.getState().openSettingsPage()
      }
    })
    .catch(() => {})

  // Why: View > Appearance toggles settings in main and broadcasts; merge into the store for an immediate re-render.
  unsubs.push(
    window.api.settings.onChanged((updates) => {
      const store = useAppStore.getState()
      if (!store.settings) {
        return
      }
      const { worktreeVisibilityDefaults, ...activeOwnerUpdates } = updates
      const settingsUpdates = store.settings.activeRuntimeEnvironmentId
        ? activeOwnerUpdates
        : updates
      useAppStore.setState({
        settings: {
          ...store.settings,
          ...settingsUpdates,
          notifications: {
            ...store.settings.notifications,
            ...updates.notifications
          }
        },
        ...(worktreeVisibilityDefaults
          ? {
              worktreeVisibilityDefaultsByHost: {
                ...store.worktreeVisibilityDefaultsByHost,
                local: worktreeVisibilityDefaults
              }
            }
          : {})
      })
      if ('worktreeVisibilityDefaults' in updates) {
        void store.fetchAllWorktrees({ visibilityOwnerHostId: 'local' })
      }
    })
  )

  // Why: UI view-state is shared with mobile via ui.set; re-hydrate so mobile changes reflect live in the desktop sidebar.
  unsubs.push(
    window.api.ui.onStateChanged((ui) => {
      useAppStore.getState().hydratePersistedUI(ui, 'sync')
    })
  )

  if (window.api.keybindings) {
    unsubs.push(
      window.api.keybindings.onChanged((snapshot) => {
        useAppStore.getState().setKeybindingSnapshot(snapshot)
      })
    )
  }

  unsubs.push(
    window.api.ui.onToggleLeftSidebar(() => {
      useAppStore.getState().toggleSidebar()
    })
  )

  unsubs.push(
    window.api.ui.onToggleRightSidebar(() => {
      const store = useAppStore.getState()
      if (!canShowRightSidebarForView(store.activeView)) {
        return
      }
      store.toggleRightSidebar()
    })
  )

  unsubs.push(
    window.api.ui.onToggleWorktreePalette(() => {
      const store = useAppStore.getState()
      if (store.activeModal === 'worktree-palette') {
        store.closeModal()
        return
      }
      store.openModal('worktree-palette')
    })
  )

  unsubs.push(
    window.api.ui.onToggleFloatingTerminal(() => {
      window.dispatchEvent(new CustomEvent(TOGGLE_FLOATING_TERMINAL_EVENT))
    })
  )

  if (window.api.ui.onTerminalShortcutCaptured) {
    unsubs.push(
      window.api.ui.onTerminalShortcutCaptured(({ actionId }) => {
        showTerminalShortcutCaptureNotification({
          actionId,
          platform: getShortcutPlatform(),
          keybindings: useAppStore.getState().keybindings
        })
      })
    )
  }
}
