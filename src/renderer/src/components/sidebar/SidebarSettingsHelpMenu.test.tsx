// @vitest-environment happy-dom

import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SidebarSettingsHelpMenu } from './SidebarSettingsHelpMenu'

const mocks = vi.hoisted(() => ({
  openSettingsPage: vi.fn(),
  openSettingsTarget: vi.fn(),
  appRestart: vi.fn(),
  useShortcutKeyDetails: vi.fn()
}))

const roots: Root[] = []

vi.mock('@/store', () => ({
  useAppStore: (selector: (state: unknown) => unknown) =>
    selector({
      openSettingsPage: mocks.openSettingsPage,
      openSettingsTarget: mocks.openSettingsTarget
    })
}))

vi.mock('@/hooks/useShortcutLabel', () => ({
  useShortcutKeyDetails: mocks.useShortcutKeyDetails
}))

vi.mock('@/hooks/useMountedRef', () => ({
  useMountedRef: () => ({ current: true })
}))

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuItem: ({
    children,
    disabled,
    onSelect
  }: {
    children: ReactNode
    disabled?: boolean
    onSelect?: () => void
  }) => (
    <button data-testid="menu-item" disabled={disabled} onClick={onSelect}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>
}))

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    'aria-label': ariaLabel
  }: {
    children: ReactNode
    onClick?: () => void
    'aria-label'?: string
  }) => (
    <button data-testid="trigger-button" aria-label={ariaLabel} onClick={onClick}>
      {children}
    </button>
  )
}))

vi.mock('sonner', () => ({
  toast: { info: vi.fn(), error: vi.fn() }
}))

async function renderMenu(): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push(root)
  await act(async () => root.render(<SidebarSettingsHelpMenu />))
  return container
}

function findMenuItem(container: HTMLElement, label: string): HTMLButtonElement {
  const item = Array.from(
    container.querySelectorAll<HTMLButtonElement>('[data-testid="menu-item"]')
  ).find((candidate) => candidate.textContent?.includes(label))
  expect(item).toBeDefined()
  return item as HTMLButtonElement
}

describe('SidebarSettingsHelpMenu', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    vi.clearAllMocks()
    mocks.appRestart.mockResolvedValue(undefined)
    mocks.useShortcutKeyDetails.mockReturnValue({ keys: ['⌘', ','], doubleTap: false })
    Object.assign(window, { api: { app: { restart: mocks.appRestart } } })
  })

  afterEach(() => {
    roots.splice(0).forEach((root) => act(() => root.unmount()))
    document.body.replaceChildren()
  })

  it('keeps only local help actions', () => {
    const html = renderToStaticMarkup(<SidebarSettingsHelpMenu />)

    expect(html).toContain('Keyboard Shortcuts')
    expect(html).toContain('Restart Kondex')
    expect(html).not.toMatch(
      /Send Feedback|Milestones|Onboarding|Docs|Changelog|GitHub|Discord|Restart Orca/
    )
  })

  it('renders settings before help and includes the shortcut hint', () => {
    const html = renderToStaticMarkup(<SidebarSettingsHelpMenu />)

    expect(html.indexOf('lucide-settings')).toBeGreaterThanOrEqual(0)
    expect(html.indexOf('lucide-circle-question-mark')).toBeGreaterThan(
      html.indexOf('lucide-settings')
    )
    expect(html).toContain('⌘')
    expect(html).toContain('>,</span>')
  })

  it('opens shortcut settings', async () => {
    const container = await renderMenu()
    await act(async () => findMenuItem(container, 'Keyboard Shortcuts').click())

    expect(mocks.openSettingsTarget).toHaveBeenCalledWith({ pane: 'shortcuts', repoId: null })
    expect(mocks.openSettingsPage).toHaveBeenCalledOnce()
  })

  it('restarts Kondex through the local app bridge', async () => {
    const container = await renderMenu()
    await act(async () => findMenuItem(container, 'Restart Kondex').click())

    expect(mocks.appRestart).toHaveBeenCalledOnce()
  })
})
