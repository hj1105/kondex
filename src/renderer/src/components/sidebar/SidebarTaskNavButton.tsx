import React from 'react'
import { Braces, EyeOff } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'

export function SidebarTaskNavButton(): React.JSX.Element | null {
  const openTaskPage = useAppStore((state) => state.openTaskPage)
  const updateSettings = useAppStore((state) => state.updateSettings)
  const activeView = useAppStore((state) => state.activeView)
  const showTasksButton = useAppStore((state) => state.settings?.showTasksButton !== false)

  const hideTasksButton = React.useCallback(() => {
    void updateSettings({ showTasksButton: false })
  }, [updateSettings])

  if (!showTasksButton) {
    return null
  }

  const tasksActive = activeView === 'tasks'

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          type="button"
          onClick={() => openTaskPage()}
          aria-current={tasksActive ? 'page' : undefined}
          className={cn(
            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium tracking-tight transition-colors',
            tasksActive
              ? 'bg-worktree-sidebar-accent text-worktree-sidebar-accent-foreground'
              : 'text-worktree-sidebar-foreground/60 hover:bg-worktree-sidebar-foreground/8'
          )}
        >
          <Braces
            className={cn('size-4 shrink-0', !tasksActive && 'text-worktree-sidebar-foreground/30')}
            strokeWidth={tasksActive ? 2.25 : 1.75}
          />
          <span className="flex-1">
            {translate('kondex.runtime.workItems', 'Logic Work Items')}
          </span>
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={hideTasksButton}>
          <EyeOff className="size-3.5" />
          {translate('auto.components.sidebar.SidebarTaskNavButton.hide', 'Hide from sidebar')}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
