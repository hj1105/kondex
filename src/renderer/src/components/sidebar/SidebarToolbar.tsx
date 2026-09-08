import React from 'react'
import { Kanban } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { ScrollToCurrentWorkspaceToolbarButton } from './ScrollToCurrentWorkspaceToolbarButton'
import { SidebarSettingsHelpMenu } from './SidebarSettingsHelpMenu'
import { translate } from '@/i18n/i18n'

type SidebarToolbarProps = {
  workspaceBoardOpen: boolean
  workspaceBoardDragPreviewOpen?: boolean
  onWorkspaceBoardToggle: () => void
}

const SidebarToolbar = React.memo(function SidebarToolbar({
  workspaceBoardOpen,
  workspaceBoardDragPreviewOpen = false,
  onWorkspaceBoardToggle
}: SidebarToolbarProps) {
  // Why: this memo boundary needs its own language subscription, while
  // translate() preserves Orca's pseudo-localization behavior. Without it the
  // toolbar (and the ScrollToCurrentWorkspaceToolbarButton it renders) keeps
  // whatever language was active at boot — English, since the persisted locale
  // is applied asynchronously after the lazy catalog loads.
  useTranslation()
  return (
    <div className="mt-auto shrink-0">
      <div className="flex items-center justify-between border-t border-worktree-sidebar-border px-2 py-1.5">
        <div className="flex min-w-0 items-center gap-1">
          <SidebarSettingsHelpMenu />
        </div>
        <div className="flex items-center gap-1">
          <ScrollToCurrentWorkspaceToolbarButton />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                // Why: previewing the board from a card drag lights up the
                // trigger so it's clear the drag is another way to open it.
                variant={
                  workspaceBoardOpen || workspaceBoardDragPreviewOpen ? 'secondary' : 'ghost'
                }
                size="icon-xs"
                type="button"
                aria-label={translate(
                  'auto.components.sidebar.SidebarToolbar.49f62c5665',
                  'Workspace board'
                )}
                aria-pressed={workspaceBoardOpen}
                data-workspace-board-trigger=""
                data-workspace-board-preview={workspaceBoardDragPreviewOpen ? 'true' : undefined}
                onClick={onWorkspaceBoardToggle}
                className="text-muted-foreground"
              >
                <Kanban className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4}>
              {workspaceBoardOpen
                ? translate(
                    'auto.components.sidebar.SidebarToolbar.a30e34eb5c',
                    'Close workspace board'
                  )
                : translate('auto.components.sidebar.SidebarToolbar.49f62c5665', 'Workspace board')}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  )
})

export default SidebarToolbar
