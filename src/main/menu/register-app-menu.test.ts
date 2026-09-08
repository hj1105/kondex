import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  buildFromTemplateMock,
  setApplicationMenuMock,
  getFocusedWindowMock,
  getFocusedWebContentsMock,
  sendActionToFirstResponderMock
} = vi.hoisted(() => ({
  buildFromTemplateMock: vi.fn(),
  setApplicationMenuMock: vi.fn(),
  getFocusedWindowMock: vi.fn(),
  getFocusedWebContentsMock: vi.fn(),
  sendActionToFirstResponderMock: vi.fn()
}))

vi.mock('electron', () => ({
  BrowserWindow: {
    getFocusedWindow: getFocusedWindowMock
  },
  Menu: {
    buildFromTemplate: buildFromTemplateMock,
    setApplicationMenu: setApplicationMenuMock,
    sendActionToFirstResponder: sendActionToFirstResponderMock
  },
  app: {
    name: 'Kondex'
  },
  webContents: {
    getFocusedWebContents: getFocusedWebContentsMock
  }
}))

import { getNextDefaultOnAppearanceSettingValue, registerAppMenu } from './register-app-menu'

const isMac = process.platform === 'darwin'

function buildMenuOptions() {
  return {
    onOpenSettings: vi.fn(),
    onBeforeReload: vi.fn(),
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onZoomReset: vi.fn(),
    onToggleLeftSidebar: vi.fn(),
    onToggleRightSidebar: vi.fn(),
    onToggleAppearance: vi.fn(),
    getAppearanceState: vi.fn(() => ({
      showTasksButton: true,
      showAutomationsButton: true,
      showTitlebarAppName: true,
      statusBarVisible: true
    }))
  }
}

function getTemplate(): Electron.MenuItemConstructorOptions[] {
  return buildFromTemplateMock.mock.calls[0][0] as Electron.MenuItemConstructorOptions[]
}

function getSubmenu(
  template: Electron.MenuItemConstructorOptions[],
  label: string
): Electron.MenuItemConstructorOptions[] {
  const item = template.find((entry) => entry.label === label)
  return (item?.submenu ?? []) as Electron.MenuItemConstructorOptions[]
}

describe('registerAppMenu', () => {
  it('toggles missing default-on appearance settings from visible to hidden', () => {
    expect(getNextDefaultOnAppearanceSettingValue(undefined)).toBe(false)
    expect(getNextDefaultOnAppearanceSettingValue(true)).toBe(false)
    expect(getNextDefaultOnAppearanceSettingValue(false)).toBe(true)
  })

  beforeEach(() => {
    buildFromTemplateMock.mockReset()
    setApplicationMenuMock.mockReset()
    getFocusedWindowMock.mockReset()
    getFocusedWebContentsMock.mockReset()
    sendActionToFirstResponderMock.mockReset()
    buildFromTemplateMock.mockImplementation((template) => ({ template }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows reload shortcuts as policy-routed menu hints', () => {
    registerAppMenu(buildMenuOptions())

    expect(buildFromTemplateMock).toHaveBeenCalledTimes(1)
    const viewSubmenu = getSubmenu(getTemplate(), 'View')
    const expectedForceReloadLabel = `Force Reload\t${isMac ? '⌘⇧R' : 'Ctrl+Shift+R'}`

    expect(viewSubmenu).toEqual(
      expect.arrayContaining([expect.objectContaining({ label: 'Reload' })])
    )

    const reloadItem = viewSubmenu.find((item) => item.label === 'Reload')
    expect(reloadItem?.accelerator).toBeUndefined()
    const forceReloadItem = viewSubmenu.find((item) => item.label === expectedForceReloadLabel)
    expect(forceReloadItem).toBeDefined()
    expect(forceReloadItem?.accelerator).toBeUndefined()
  })

  it('reloads the focused window from the view menu', () => {
    const reloadMock = vi.fn()
    const reloadIgnoringCacheMock = vi.fn()
    const options = buildMenuOptions()
    options.onBeforeReload = vi.fn()
    getFocusedWindowMock.mockReturnValue({
      webContents: {
        id: 101,
        reload: reloadMock,
        reloadIgnoringCache: reloadIgnoringCacheMock
      }
    })

    registerAppMenu(options)

    const reloadItem = getSubmenu(getTemplate(), 'View').find((item) => item.label === 'Reload')
    reloadItem?.click?.({} as never, {} as never, {} as never)

    expect(reloadMock).toHaveBeenCalledTimes(1)
    expect(reloadIgnoringCacheMock).not.toHaveBeenCalled()
    expect(options.onBeforeReload).toHaveBeenCalledWith({ ignoreCache: false, webContentsId: 101 })
  })

  it('force reloads the focused window from the view menu', () => {
    const reloadMock = vi.fn()
    const reloadIgnoringCacheMock = vi.fn()
    const options = buildMenuOptions()
    options.onBeforeReload = vi.fn()
    getFocusedWindowMock.mockReturnValue({
      webContents: {
        id: 102,
        reload: reloadMock,
        reloadIgnoringCache: reloadIgnoringCacheMock
      }
    })

    registerAppMenu(options)

    const forceReloadItem = getSubmenu(getTemplate(), 'View').find((item) =>
      item.label?.startsWith('Force Reload\t')
    )
    forceReloadItem?.click?.({} as never, {} as never, {} as never)

    expect(reloadIgnoringCacheMock).toHaveBeenCalledTimes(1)
    expect(reloadMock).not.toHaveBeenCalled()
    expect(options.onBeforeReload).toHaveBeenCalledWith({ ignoreCache: true, webContentsId: 102 })
  })

  it('shows the worktree palette shortcut as a display-only menu hint', () => {
    registerAppMenu(buildMenuOptions())

    const viewSubmenu = getSubmenu(getTemplate(), 'View')
    const expectedLabel = `Open Worktree Palette\t${isMac ? '⌘J' : 'Ctrl+Shift+J'}`
    const paletteItem = viewSubmenu.find((item) => item.label === expectedLabel)

    expect(paletteItem).toBeDefined()
    expect(paletteItem?.accelerator).toBeUndefined()
  })

  // Why: pin the platform on every case — CI runs this suite on Linux only, so an
  // unpinned test leaves the other platforms' branches entirely uncovered.
  it.each(['darwin', 'linux', 'win32'] as const)(
    'routes Edit > Paste through Kondex coordinated paste ownership on %s',
    (platform) => {
      vi.spyOn(process, 'platform', 'get').mockReturnValue(platform)
      const send = vi.fn()
      const hostContents = { send }
      getFocusedWindowMock.mockReturnValue({ webContents: hostContents })
      getFocusedWebContentsMock.mockReturnValue(hostContents)
      registerAppMenu(buildMenuOptions())

      const editSubmenu = getSubmenu(getTemplate(), 'Edit')
      const pasteItem = editSubmenu.find((item) => item.label === 'Paste')

      expect(pasteItem).toBeDefined()
      expect(pasteItem?.role).toBeUndefined()
      expect(pasteItem?.accelerator).toBe('CmdOrCtrl+V')

      pasteItem?.click?.({} as never, {} as never, {} as never)

      expect(send).toHaveBeenCalledOnce()
      expect(send).toHaveBeenCalledWith('ui:appMenuPaste')
      expect(sendActionToFirstResponderMock).not.toHaveBeenCalled()
    }
  )

  it.each(['darwin', 'linux', 'win32'] as const)(
    'preserves terminal undo and redo chords on %s',
    (platform) => {
      vi.spyOn(process, 'platform', 'get').mockReturnValue(platform)
      registerAppMenu(buildMenuOptions())

      const editSubmenu = getSubmenu(getTemplate(), 'Edit')
      const expectedRegistration = platform === 'darwin' ? undefined : false
      const undoItem = editSubmenu.find((item) => item.role === 'undo')
      const redoItem = editSubmenu.find((item) => item.role === 'redo')

      expect(undoItem?.accelerator).toBeUndefined()
      expect(redoItem?.accelerator).toBeUndefined()
      expect(undoItem && 'registerAccelerator' in undoItem).toBe(platform !== 'darwin')
      expect(redoItem && 'registerAccelerator' in redoItem).toBe(platform !== 'darwin')
      expect(undoItem?.registerAccelerator).toBe(expectedRegistration)
      expect(redoItem?.registerAccelerator).toBe(expectedRegistration)
    }
  )

  it('keeps selection actions native in a focused guest webview', () => {
    const send = vi.fn()
    const guestContents = { copy: vi.fn(), selectAll: vi.fn() }
    getFocusedWindowMock.mockReturnValue({ webContents: { send } })
    getFocusedWebContentsMock.mockReturnValue(guestContents)
    registerAppMenu(buildMenuOptions())

    const editSubmenu = getSubmenu(getTemplate(), 'Edit')
    editSubmenu
      .find((item) => item.label === 'Copy')
      ?.click?.({} as never, {} as never, {} as never)
    editSubmenu
      .find((item) => item.label === 'Select All')
      ?.click?.({} as never, {} as never, {} as never)

    expect(guestContents.copy).toHaveBeenCalledOnce()
    expect(guestContents.selectAll).toHaveBeenCalledOnce()
    expect(send).not.toHaveBeenCalled()
  })

  it.each(['darwin', 'linux', 'win32'] as const)(
    'routes Edit selection actions through the focused Kondex window on %s',
    (platform) => {
      vi.spyOn(process, 'platform', 'get').mockReturnValue(platform)
      const send = vi.fn()
      getFocusedWindowMock.mockReturnValue({ webContents: { send } })
      registerAppMenu(buildMenuOptions())

      const editSubmenu = getSubmenu(getTemplate(), 'Edit')
      const copyItem = editSubmenu.find((item) => item.label === 'Copy')
      const selectAllItem = editSubmenu.find((item) => item.label === 'Select All')

      expect(copyItem?.role).toBeUndefined()
      expect(selectAllItem?.role).toBeUndefined()
      expect(copyItem?.accelerator).toBe(platform === 'darwin' ? 'Command+C' : undefined)
      expect(selectAllItem?.accelerator).toBe(platform === 'darwin' ? 'Command+A' : undefined)

      copyItem?.click?.({} as never, {} as never, {} as never)
      selectAllItem?.click?.({} as never, {} as never, {} as never)

      expect(send.mock.calls).toEqual([
        ['ui:appMenuSelectionAction', 'copy'],
        ['ui:appMenuSelectionAction', 'select-all']
      ])
    }
  )

  it('routes macOS selection actions to the native responder without a focused window', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin')
    getFocusedWindowMock.mockReturnValue(null)
    registerAppMenu(buildMenuOptions())

    const editSubmenu = getSubmenu(getTemplate(), 'Edit')
    editSubmenu
      .find((item) => item.label === 'Copy')
      ?.click?.({} as never, {} as never, {} as never)
    editSubmenu
      .find((item) => item.label === 'Select All')
      ?.click?.({} as never, {} as never, {} as never)

    expect(sendActionToFirstResponderMock.mock.calls).toEqual([['copy:'], ['selectAll:']])
  })

  it('routes Edit > Paste to the native first responder once on macOS without a focused window', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin')
    getFocusedWindowMock.mockReturnValue(null)
    registerAppMenu(buildMenuOptions())

    const pasteItem = getSubmenu(getTemplate(), 'Edit').find((item) => item.label === 'Paste')
    pasteItem?.click?.({} as never, {} as never, {} as never)

    expect(sendActionToFirstResponderMock).toHaveBeenCalledOnce()
    expect(sendActionToFirstResponderMock).toHaveBeenCalledWith('paste:')
  })

  it.each(['linux', 'win32'] as const)(
    'does not invoke the native paste responder on %s without a focused window',
    (platform) => {
      vi.spyOn(process, 'platform', 'get').mockReturnValue(platform)
      getFocusedWindowMock.mockReturnValue(null)
      registerAppMenu(buildMenuOptions())

      const pasteItem = getSubmenu(getTemplate(), 'Edit').find((item) => item.label === 'Paste')
      // Why: this case asserts only a negative, so it would pass green if the item vanished.
      expect(pasteItem).toBeDefined()
      pasteItem?.click?.({} as never, {} as never, {} as never)

      expect(sendActionToFirstResponderMock).not.toHaveBeenCalled()
    }
  )

  it.runIf(!isMac)('puts Settings and Exit under File on Windows/Linux', () => {
    registerAppMenu(buildMenuOptions())

    const template = getTemplate()
    // Why: no redundant app-named "Kondex" menu should exist on non-mac — the
    // app-menu contents (Settings, Exit, About) have been redistributed so
    // users see them in File / Help instead.
    expect(template.find((item) => item.label === 'Kondex')).toBeUndefined()

    const fileLabels = getSubmenu(template, 'File').map((item) => item.label)
    expect(fileLabels).not.toContain(`Export as PDF...\t${isMac ? '⌘⇧E' : 'Ctrl+Shift+E'}`)
    expect(fileLabels[0]).toBe(`Settings\t${isMac ? '⌘,' : 'Ctrl+,'}`)
    expect(fileLabels).toEqual(
      expect.arrayContaining([`Settings\t${isMac ? '⌘,' : 'Ctrl+,'}`, 'Exit'])
    )

    expect(getSubmenu(template, 'Help')).toEqual([expect.objectContaining({ role: 'about' })])
  })

  it.runIf(isMac)('keeps the macOS app-named menu with Settings and quit roles', () => {
    registerAppMenu(buildMenuOptions())

    const template = getTemplate()
    const appSubmenu = getSubmenu(template, 'Kondex')
    const appLabels = appSubmenu.map((item) => item.label)
    expect(appLabels).toEqual(expect.arrayContaining([`Settings\t${isMac ? '⌘,' : 'Ctrl+,'}`]))
    // Why: on macOS File should NOT duplicate Settings/Exit — those live in
    // the system app menu. Without global Export, there is no File item left.
    expect(template.find((item) => item.label === 'File')).toBeUndefined()
    expect(template.find((item) => item.label === 'Help')).toBeUndefined()
  })

  it.each(['darwin', 'linux', 'win32'] as const)(
    'omits Orca-only native menu surfaces on %s',
    (platform) => {
      vi.spyOn(process, 'platform', 'get').mockReturnValue(platform)
      registerAppMenu(buildMenuOptions())

      const collectLabels = (items: Electron.MenuItemConstructorOptions[]): string[] =>
        items.flatMap((item) => [
          ...(typeof item.label === 'string' ? [item.label] : []),
          ...(Array.isArray(item.submenu) ? collectLabels(item.submenu) : [])
        ])

      expect(collectLabels(getTemplate())).not.toEqual(
        expect.arrayContaining(['Getting Started with Orca', 'Report Crash...'])
      )
      if (platform === 'darwin') {
        expect(getTemplate().find((item) => item.label === 'Help')).toBeUndefined()
      } else {
        expect(getSubmenu(getTemplate(), 'Help')).toEqual([
          expect.objectContaining({ role: 'about' })
        ])
      }
    }
  )

  it('exposes an Appearance submenu under View with checkbox items reflecting state', () => {
    const options = buildMenuOptions()
    options.getAppearanceState.mockReturnValue({
      showTasksButton: false,
      showAutomationsButton: false,
      showTitlebarAppName: true,
      statusBarVisible: true
    })
    registerAppMenu(options)

    const viewSubmenu = getSubmenu(getTemplate(), 'View')
    const appearanceEntry = viewSubmenu.find((item) => item.label === 'Appearance')
    expect(appearanceEntry).toBeDefined()

    const appearanceSubmenu = (appearanceEntry?.submenu ??
      []) as Electron.MenuItemConstructorOptions[]
    const tasksItem = appearanceSubmenu.find((item) => item.label === 'Show Tasks Button')
    expect(tasksItem?.type).toBe('checkbox')
    expect(tasksItem?.checked).toBe(false)

    const automationsItem = appearanceSubmenu.find(
      (item) => item.label === 'Show Automations Button'
    )
    expect(automationsItem?.type).toBe('checkbox')
    expect(automationsItem?.checked).toBe(false)

    const titlebarItem = appearanceSubmenu.find((item) => item.label === 'Show Titlebar App Name')
    expect(titlebarItem?.checked).toBe(true)

    const statusBarItem = appearanceSubmenu.find((item) => item.label === 'Show Status Bar')
    expect(statusBarItem?.checked).toBe(true)
  })

  it('routes Appearance checkbox clicks through onToggleAppearance', () => {
    const options = buildMenuOptions()
    registerAppMenu(options)

    const viewSubmenu = getSubmenu(getTemplate(), 'View')
    const appearanceSubmenu = (viewSubmenu.find((item) => item.label === 'Appearance')?.submenu ??
      []) as Electron.MenuItemConstructorOptions[]

    appearanceSubmenu
      .find((item) => item.label === 'Show Tasks Button')
      ?.click?.({} as never, {} as never, {} as never)
    appearanceSubmenu
      .find((item) => item.label === 'Show Automations Button')
      ?.click?.({} as never, {} as never, {} as never)
    appearanceSubmenu
      .find((item) => item.label === 'Show Titlebar App Name')
      ?.click?.({} as never, {} as never, {} as never)

    expect(options.onToggleAppearance).toHaveBeenCalledWith('showTasksButton')
    expect(options.onToggleAppearance).toHaveBeenCalledWith('showAutomationsButton')
    expect(options.onToggleAppearance).toHaveBeenCalledWith('showTitlebarAppName')
  })

  it('routes sidebar toggle items through their callbacks', () => {
    const options = buildMenuOptions()
    registerAppMenu(options)

    const viewSubmenu = getSubmenu(getTemplate(), 'View')
    const appearanceSubmenu = (viewSubmenu.find((item) => item.label === 'Appearance')?.submenu ??
      []) as Electron.MenuItemConstructorOptions[]

    const leftLabel = `Toggle Left Sidebar\t${isMac ? '⌘B' : 'Ctrl+B'}`
    const rightLabel = `Toggle Right Sidebar\t${isMac ? '⌘L' : 'Ctrl+L'}`

    appearanceSubmenu
      .find((item) => item.label === leftLabel)
      ?.click?.({} as never, {} as never, {} as never)
    appearanceSubmenu
      .find((item) => item.label === rightLabel)
      ?.click?.({} as never, {} as never, {} as never)

    expect(options.onToggleLeftSidebar).toHaveBeenCalledTimes(1)
    expect(options.onToggleRightSidebar).toHaveBeenCalledTimes(1)
    // Why: these entries must not bind Cmd/Ctrl+B as real accelerators
    // because before-input-event carries a TipTap-bold carve-out that the
    // menu accelerator would bypass.
    expect(appearanceSubmenu.find((item) => item.label === leftLabel)?.accelerator).toBeUndefined()
    expect(appearanceSubmenu.find((item) => item.label === rightLabel)?.accelerator).toBeUndefined()
  })
})
