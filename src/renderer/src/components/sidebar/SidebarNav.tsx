import React from 'react'
import { BookOpen, CalendarClock, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { useShortcutKeyComboDetails } from '@/hooks/useShortcutLabel'
import { ShortcutKeyCombo } from '@/components/ShortcutKeyCombo'
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu'
import { SidebarTaskNavButton } from './SidebarTaskNavButton'
import { HideSidebarMenu } from './sidebar-nav-controls'
import { translate } from '@/i18n/i18n'
import { lazyWithRetry } from '@/lib/lazy-with-retry'
import type { GlobalSettings } from '../../../../shared/global-settings-types'

export function shouldShowAutomationsButton(
  settings: Partial<Pick<GlobalSettings, 'showAutomationsButton'>> | null | undefined
): boolean {
  return settings?.showAutomationsButton !== false
}

export function shouldShowSkillsButton(
  settings: Partial<Pick<GlobalSettings, 'showSkillsButton'>> | null | undefined
): boolean {
  return settings?.showSkillsButton === true
}

export function shouldShowAgentDashboardButton(
  settings: Partial<Pick<GlobalSettings, 'experimentalAgentDashboardPopout'>> | null | undefined
): boolean {
  return settings?.experimentalAgentDashboardPopout === true
}

const AgentDashboardSidebarEntry = lazyWithRetry(() => import('./AgentDashboardSidebarEntry'))

const SidebarNav = React.memo(function SidebarNav() {
  // Why: this memo boundary needs its own language subscription, while
  // translate() preserves Orca's pseudo-localization behavior.
  useTranslation()
  const worktreePaletteShortcutCombos = useShortcutKeyComboDetails('worktree.palette')
  const openAutomationsPage = useAppStore((s) => s.openAutomationsPage)
  const openSkillsPage = useAppStore((s) => s.openSkillsPage)
  const openModal = useAppStore((s) => s.openModal)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const activeView = useAppStore((s) => s.activeView)
  const showAgentDashboardButton = useAppStore((s) => shouldShowAgentDashboardButton(s.settings))
  const showAutomationsButton = useAppStore((s) => shouldShowAutomationsButton(s.settings))
  const showSkillsButton = useAppStore((s) => shouldShowSkillsButton(s.settings))
  const automationsActive = activeView === 'automations'
  const skillsActive = activeView === 'skills'
  const hideAutomationsButton = React.useCallback(() => {
    void updateSettings({ showAutomationsButton: false })
  }, [updateSettings])
  const hideSkillsButton = React.useCallback(() => {
    void updateSettings({ showSkillsButton: false })
  }, [updateSettings])

  return (
    <div className="flex flex-col gap-0.5 px-2 pt-2 pb-1">
      <button
        type="button"
        onClick={() => openModal('worktree-palette')}
        aria-label={translate(
          'auto.components.sidebar.SidebarNav.0c3395fd32',
          'Search worktrees and browser tabs'
        )}
        className="group flex w-full items-center gap-2 rounded-md bg-worktree-sidebar-foreground/5 px-2 py-1.5 text-left text-[13px] font-medium tracking-tight text-worktree-sidebar-foreground/60 transition-colors hover:bg-worktree-sidebar-foreground/8"
      >
        <Search
          className="size-4 shrink-0 text-worktree-sidebar-foreground/30"
          strokeWidth={1.75}
        />
        <span className="flex-1">
          {translate('auto.components.sidebar.SidebarNav.80611a8b10', 'Search')}
        </span>
        <span className="pointer-events-none hidden shrink-0 items-center gap-1 group-hover:flex group-focus-within:flex">
          {worktreePaletteShortcutCombos.map((combo) => (
            <ShortcutKeyCombo
              key={combo.keys.join('-')}
              keys={combo.keys}
              doubleTap={combo.doubleTap}
              className="inline-flex gap-0.5"
              keyCapClassName="min-w-4 border-worktree-sidebar-border/80 bg-worktree-sidebar-foreground/8 px-1 py-px text-[9px] text-worktree-sidebar-foreground/55 shadow-none"
              separatorClassName="text-[9px] text-worktree-sidebar-foreground/45"
            />
          ))}
        </span>
      </button>
      <SidebarTaskNavButton />
      {showSkillsButton ? (
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <button
              type="button"
              onClick={openSkillsPage}
              aria-current={skillsActive ? 'page' : undefined}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium tracking-tight transition-colors',
                skillsActive
                  ? 'bg-worktree-sidebar-accent text-worktree-sidebar-accent-foreground'
                  : 'text-worktree-sidebar-foreground/60 hover:bg-worktree-sidebar-foreground/8'
              )}
            >
              <BookOpen
                className={cn(
                  'size-4 shrink-0',
                  !skillsActive && 'text-worktree-sidebar-foreground/30'
                )}
                strokeWidth={skillsActive ? 2.25 : 1.75}
              />
              <span className="flex-1">
                {translate('auto.components.sidebar.SidebarNav.skills', 'Skills')}
              </span>
            </button>
          </ContextMenuTrigger>
          <HideSidebarMenu onHide={hideSkillsButton} />
        </ContextMenu>
      ) : null}
      {showAutomationsButton ? (
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <button
              type="button"
              onClick={openAutomationsPage}
              aria-current={automationsActive ? 'page' : undefined}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium tracking-tight transition-colors',
                automationsActive
                  ? 'bg-worktree-sidebar-accent text-worktree-sidebar-accent-foreground'
                  : 'text-worktree-sidebar-foreground/60 hover:bg-worktree-sidebar-foreground/8'
              )}
            >
              <CalendarClock
                className={cn(
                  'size-4 shrink-0',
                  !automationsActive && 'text-worktree-sidebar-foreground/30'
                )}
                strokeWidth={automationsActive ? 2.25 : 1.75}
              />
              <span className="flex-1">
                {translate('auto.components.sidebar.SidebarNav.f323383e9a', 'Automations')}
              </span>
            </button>
          </ContextMenuTrigger>
          <HideSidebarMenu onHide={hideAutomationsButton} />
        </ContextMenu>
      ) : null}
      {showAgentDashboardButton ? (
        <React.Suspense fallback={null}>
          <AgentDashboardSidebarEntry />
        </React.Suspense>
      ) : null}
    </div>
  )
})

export default SidebarNav
