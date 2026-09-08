// @vitest-environment happy-dom

import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { getDefaultSettings } from '../../../../shared/constants'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import type { Repo } from '../../../../shared/repo-types'
import { i18n } from '../../i18n/i18n'
import { PSEUDO_LOCALIZATION_LOCALE } from '../../i18n/pseudo-localization'

const mocks = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  openTaskPage: vi.fn(),
  openAutomationsPage: vi.fn(),
  openActivityPage: vi.fn(),
  openModal: vi.fn(),
  updateSettings: vi.fn(),
  refreshPreflightStatus: vi.fn(),
  checkLinearConnection: vi.fn(),
  agentBucketCounts: { attention: 0, working: 0, done: 0, idle: 0 },
  getAgentBucketCounts: vi.fn(),
  setSetupGuideSidebarDismissed: vi.fn()
}))

vi.mock('@/store', () => ({
  useAppStore: (selector: (state: Record<string, unknown>) => unknown) => selector(mocks.state)
}))

vi.mock('@/store/selectors', () => ({
  useRepoMap: () =>
    new Map(
      ((mocks.state.repos as Repo[] | undefined) ?? []).map((repo) => [repo.id, repo] as const)
    )
}))

vi.mock('@/components/activity/useActivityUnreadCount', () => ({
  useActivityUnreadCount: () => 0
}))

vi.mock('@/components/dashboard/useAgentBucketCounts', () => ({
  useAgentBucketCounts: () => {
    mocks.getAgentBucketCounts()
    return mocks.agentBucketCounts
  }
}))

vi.mock('@/hooks/useShortcutLabel', () => ({
  useShortcutKeyComboDetails: () => [{ keys: ['⌘', 'J'], doubleTap: false }]
}))

vi.mock('@/components/ui/context-menu', () => ({
  ContextMenu: ({ children }: { children: ReactNode }) => (
    <div data-testid="context-menu">{children}</div>
  ),
  ContextMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  ContextMenuContent: ({ children }: { children: ReactNode }) => (
    <div data-testid="context-menu-content">{children}</div>
  ),
  ContextMenuItem: ({ children, onSelect }: { children: ReactNode; onSelect?: () => void }) => (
    <button type="button" onClick={onSelect}>
      {children}
    </button>
  )
}))

import SidebarNav, { shouldShowAutomationsButton, shouldShowSkillsButton } from './SidebarNav'

function gitRepo(): Repo {
  return {
    id: 'repo-1',
    path: '/tmp/repo-1',
    displayName: 'repo-1',
    badgeColor: 'gray',
    addedAt: 1,
    kind: 'git'
  }
}

function folderRepo(): Repo {
  return {
    id: 'folder-1',
    path: '/tmp/folder-1',
    displayName: 'folder-1',
    badgeColor: 'gray',
    addedAt: 1,
    kind: 'folder'
  }
}

function setSidebarState({
  settings = getDefaultSettings('/tmp'),
  repos = [gitRepo()]
}: {
  settings?: GlobalSettings
  repos?: Repo[]
} = {}): void {
  mocks.state = {
    settings,
    repos,
    activeView: 'worktrees',
    openTaskPage: mocks.openTaskPage,
    openAutomationsPage: mocks.openAutomationsPage,
    openActivityPage: mocks.openActivityPage,
    openSkillsPage: vi.fn(),
    openModal: mocks.openModal,
    updateSettings: mocks.updateSettings,
    preflightStatus: { glab: { installed: false } },
    preflightStatusChecked: true,
    refreshPreflightStatus: mocks.refreshPreflightStatus,
    linearStatus: { connected: false },
    linearStatusChecked: true,
    checkLinearConnection: mocks.checkLinearConnection,
    prefetchWorkItems: vi.fn(),
    activeRepoId: null,
    persistedUIReady: true,
    activeModal: null,
    setupGuideSidebarDismissed: true,
    setSetupGuideSidebarDismissed: mocks.setSetupGuideSidebarDismissed
  }
}

const mountedRoots: Root[] = []

async function renderSidebarNav(): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mountedRoots.push(root)
  await act(async () => {
    root.render(
      <TooltipProvider>
        <SidebarNav />
      </TooltipProvider>
    )
  })
  return container
}

function queryButtonByText(container: ParentNode, text: string): HTMLButtonElement | null {
  return (
    Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === text
    ) ?? null
  )
}

function getButtonByText(container: ParentNode, text: string): HTMLButtonElement {
  const button = queryButtonByText(container, text)
  if (!button) {
    throw new Error(`Button not found: ${text}`)
  }
  return button
}

function getHideButton(menu: Element): HTMLButtonElement {
  const button =
    Array.from(menu.querySelectorAll<HTMLButtonElement>('button')).find((candidate) =>
      candidate.textContent?.includes('Hide from sidebar')
    ) ?? null
  if (!button) {
    throw new Error('Hide from sidebar button not found')
  }
  return button
}

async function clickButton(button: HTMLButtonElement): Promise<void> {
  await act(async () => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

describe('SidebarNav', () => {
  afterEach(async () => {
    await act(async () => {
      for (const root of mountedRoots.splice(0)) {
        root.unmount()
      }
    })
    document.body.innerHTML = ''
  })

  beforeEach(async () => {
    vi.clearAllMocks()
    await i18n.changeLanguage('en')
    mocks.agentBucketCounts = { attention: 0, working: 0, done: 0, idle: 0 }
    setSidebarState()
  })

  it('keeps the Agent Dashboard row unmounted while its experiment is off', async () => {
    const container = await renderSidebarNav()

    expect(queryButtonByText(container, 'Agent Dashboard')).toBeNull()
    expect(mocks.getAgentBucketCounts).not.toHaveBeenCalled()
  })

  it('mounts the Agent Dashboard row only when its experiment is enabled', async () => {
    setSidebarState({
      settings: {
        ...getDefaultSettings('/tmp'),
        experimentalAgentDashboardPopout: true
      }
    })
    const container = await renderSidebarNav()

    await waitFor(() => expect(queryButtonByText(container, 'Agent Dashboard')).not.toBeNull())
    expect(mocks.getAgentBucketCounts).toHaveBeenCalledTimes(1)
  })

  it('uses a question glyph only for the Needs You count', async () => {
    mocks.agentBucketCounts = { attention: 2, working: 3, done: 1, idle: 4 }
    setSidebarState({
      settings: {
        ...getDefaultSettings('/tmp'),
        experimentalAgentDashboardPopout: true,
        experimentalAgentDashboardShowIdle: true
      }
    })
    const container = await renderSidebarNav()

    await waitFor(() =>
      expect(container.querySelector('[aria-label="Needs You: 2"]')).not.toBeNull()
    )
    const attention = container.querySelector('[aria-label="Needs You: 2"]')
    const working = container.querySelector('[aria-label="Working: 3"]')
    const done = container.querySelector('[aria-label="Done: 1"]')
    const idle = container.querySelector('[aria-label="Idle: 4"]')
    expect(attention?.querySelector('.lucide-message-circle-question-mark')).not.toBeNull()
    expect(working?.querySelector('.rounded-full')).not.toBeNull()
    expect(done?.querySelector('.rounded-full')).not.toBeNull()
    expect(idle?.querySelector('.rounded-full')).not.toBeNull()
    expect(working?.querySelector('svg')).toBeNull()
    expect(done?.querySelector('svg')).toBeNull()
    expect(idle?.querySelector('svg')).toBeNull()
  })

  it('updates localized labels when the language changes after mount', async () => {
    const container = await renderSidebarNav()

    expect(queryButtonByText(container, 'Automations')).not.toBeNull()
    expect(queryButtonByText(container, 'Logic Work Items')).not.toBeNull()

    await act(async () => {
      await i18n.changeLanguage('ko')
    })
    expect(queryButtonByText(container, '로직별 작업 항목')).not.toBeNull()

    await act(async () => {
      await i18n.changeLanguage('zh')
    })

    expect(queryButtonByText(container, '自动化')).not.toBeNull()
  })

  it('updates labels when pseudo-localization is enabled after mount', async () => {
    const container = await renderSidebarNav()

    await act(async () => {
      await i18n.changeLanguage(PSEUDO_LOCALIZATION_LOCALE)
    })

    expect(queryButtonByText(container, '[Automations]')).not.toBeNull()
  })

  it('shows the Automations entry by default for older settings', () => {
    expect(shouldShowAutomationsButton(null)).toBe(true)
    expect(shouldShowAutomationsButton({})).toBe(true)
  })

  it('hides the Automations entry when the sidebar setting is off', () => {
    expect(shouldShowAutomationsButton({ showAutomationsButton: false })).toBe(false)
  })

  it('omits the Automations row when the sidebar setting is off', async () => {
    setSidebarState({
      settings: {
        ...getDefaultSettings('/tmp'),
        showAutomationsButton: false
      }
    })

    const container = await renderSidebarNav()

    expect(queryButtonByText(container, 'Automations')).toBeNull()
  })

  it('hides Automations from its sidebar context menu', async () => {
    const container = await renderSidebarNav()

    const automationsMenu = getButtonByText(container, 'Automations').closest(
      '[data-testid="context-menu"]'
    )
    expect(automationsMenu).not.toBeNull()

    await clickButton(getHideButton(automationsMenu as HTMLElement))

    expect(mocks.updateSettings).toHaveBeenCalledWith({ showAutomationsButton: false })
  })

  it('keeps local Skills hidden unless explicitly enabled', () => {
    expect(shouldShowSkillsButton(null)).toBe(false)
    expect(shouldShowSkillsButton({})).toBe(false)
    expect(shouldShowSkillsButton({ showSkillsButton: true })).toBe(true)
  })

  it('places the worktree palette search above the sidebar nav rows', async () => {
    const container = await renderSidebarNav()
    const searchButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Search worktrees and browser tabs"]'
    )
    const tasksButton = getButtonByText(container, 'Logic Work Items')

    if (!searchButton) {
      throw new Error('worktree palette search button not rendered')
    }
    expect(
      searchButton.compareDocumentPosition(tasksButton) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('hides the worktree palette shortcut until the search field is hovered or focused', async () => {
    const container = await renderSidebarNav()

    const searchButton = container.querySelector(
      'button[aria-label="Search worktrees and browser tabs"]'
    )
    expect(searchButton).not.toBeNull()
    expect(searchButton?.className).toContain('bg-worktree-sidebar-foreground/5')

    const shortcuts = searchButton?.querySelector('span.hidden')
    expect(shortcuts?.className).toContain('hidden')
    expect(shortcuts?.className).toContain('group-hover:flex')
    expect(shortcuts?.className).toContain('group-focus-within:flex')
    expect(shortcuts?.textContent).toContain('⌘')
    expect(shortcuts?.textContent).toContain('J')
    expect(searchButton?.querySelector('kbd')).toBeNull()
  })

  it('keeps the Logic Work Items row free of legacy tracker shortcuts', async () => {
    const container = await renderSidebarNav()

    const tasksButton = getButtonByText(container, 'Logic Work Items')
    expect(tasksButton.parentElement?.querySelector('button[aria-label*="tasks"]')).toBeNull()
  })

  it('hides available Logic Work Items from its sidebar context menu', async () => {
    const container = await renderSidebarNav()

    const tasksButton = getButtonByText(container, 'Logic Work Items')

    const tasksMenu = tasksButton.closest('[data-testid="context-menu"]')
    expect(tasksMenu).not.toBeNull()
    await clickButton(getHideButton(tasksMenu as HTMLElement))

    expect(mocks.updateSettings).toHaveBeenCalledWith({ showTasksButton: false })
  })

  it('keeps Logic Work Items enabled with no git repos so Kontext can explain the empty state', async () => {
    setSidebarState({ repos: [folderRepo()] })
    const container = await renderSidebarNav()

    const tasksButton = getButtonByText(container, 'Logic Work Items')
    expect(tasksButton.getAttribute('aria-disabled')).toBeNull()
    expect(tasksButton.disabled).toBe(false)
    expect(tasksButton.className).not.toContain('opacity-50')
    expect(
      tasksButton.parentElement?.querySelector('button[aria-label="Open GitHub tasks"]')
    ).toBeNull()

    await clickButton(tasksButton)
    expect(mocks.openTaskPage).toHaveBeenCalled()

    const tasksMenu = tasksButton.closest('[data-testid="context-menu"]')
    expect(tasksMenu).not.toBeNull()
    await clickButton(getHideButton(tasksMenu as HTMLElement))

    expect(mocks.updateSettings).toHaveBeenCalledWith({ showTasksButton: false })
  })
})
