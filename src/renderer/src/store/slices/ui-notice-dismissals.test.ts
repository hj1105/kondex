import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createUIStore, makePersistedUI } from './ui-slice-test-harness'

const mocks = vi.hoisted(() => ({
  sendNotesToActiveAgentSession: vi.fn(),
  toastMessage: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn()
}))

vi.mock('@/lib/active-agent-note-send', () => ({
  activeAgentNotesSendFailureMessage: (
    status: string,
    options: { explicitTarget?: boolean } = {}
  ) => (options.explicitTarget ? `selected:${status}` : status),
  sendNotesToActiveAgentSession: mocks.sendNotesToActiveAgentSession
}))

vi.mock('sonner', () => ({
  toast: {
    message: mocks.toastMessage,
    success: mocks.toastSuccess,
    error: mocks.toastError
  }
}))

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

beforeEach(() => {
  mocks.sendNotesToActiveAgentSession.mockReset()
  mocks.sendNotesToActiveAgentSession.mockResolvedValue({ status: 'sent' })
  mocks.toastMessage.mockReset()
  mocks.toastSuccess.mockReset()
  mocks.toastError.mockReset()
})

describe('createUISlice mobile emulator agent setup dismissal', () => {
  it('persists mobile emulator agent setup dismissal once', () => {
    const setMock = vi.fn(() => Promise.resolve())
    vi.stubGlobal('window', {
      api: {
        ui: {
          set: setMock
        }
      }
    })
    const store = createUIStore()

    store.getState().dismissMobileEmulatorAgentSetup()
    store.getState().dismissMobileEmulatorAgentSetup()

    expect(store.getState().mobileEmulatorAgentSetupDismissed).toBe(true)
    expect(setMock).toHaveBeenCalledTimes(1)
    expect(setMock).toHaveBeenCalledWith({ mobileEmulatorAgentSetupDismissed: true })
  })

  it('hydrates only explicit mobile emulator agent setup dismissals', () => {
    const store = createUIStore()

    store
      .getState()
      .hydratePersistedUI(makePersistedUI({ mobileEmulatorAgentSetupDismissed: true }))
    expect(store.getState().mobileEmulatorAgentSetupDismissed).toBe(true)

    store
      .getState()
      .hydratePersistedUI(makePersistedUI({ mobileEmulatorAgentSetupDismissed: undefined }))
    expect(store.getState().mobileEmulatorAgentSetupDismissed).toBe(false)
  })
})

describe('createUISlice mobile emulator tab intro dismissal', () => {
  it('persists mobile emulator tab intro dismissal once', () => {
    const setMock = vi.fn(() => Promise.resolve())
    vi.stubGlobal('window', {
      api: {
        ui: {
          set: setMock
        }
      }
    })
    const store = createUIStore()

    store.getState().dismissMobileEmulatorTabIntro()
    store.getState().dismissMobileEmulatorTabIntro()

    expect(store.getState().mobileEmulatorTabIntroDismissed).toBe(true)
    expect(setMock).toHaveBeenCalledTimes(1)
    expect(setMock).toHaveBeenCalledWith({ mobileEmulatorTabIntroDismissed: true })
  })

  it('hydrates only explicit mobile emulator tab intro dismissals', () => {
    const store = createUIStore()

    store.getState().hydratePersistedUI(makePersistedUI({ mobileEmulatorTabIntroDismissed: true }))
    expect(store.getState().mobileEmulatorTabIntroDismissed).toBe(true)

    store
      .getState()
      .hydratePersistedUI(makePersistedUI({ mobileEmulatorTabIntroDismissed: undefined }))
    expect(store.getState().mobileEmulatorTabIntroDismissed).toBe(false)
  })
})

describe('createUISlice browser import hint dismissal', () => {
  it('persists browser import hint dismissal changes once', () => {
    const setMock = vi.fn(() => Promise.resolve())
    vi.stubGlobal('window', {
      api: {
        ui: {
          set: setMock
        }
      }
    })
    const store = createUIStore()

    store.getState().setBrowserImportHintHidden(true)
    store.getState().setBrowserImportHintHidden(true)

    expect(store.getState().browserImportHintHidden).toBe(true)
    expect(setMock).toHaveBeenCalledTimes(1)
    expect(setMock).toHaveBeenCalledWith({ browserImportHintHidden: true })
  })

  it('hydrates only explicit browser import hint dismissals as hidden', () => {
    const store = createUIStore()

    store.getState().hydratePersistedUI(makePersistedUI({ browserImportHintHidden: true }))
    expect(store.getState().browserImportHintHidden).toBe(true)

    store.getState().hydratePersistedUI(makePersistedUI({ browserImportHintHidden: undefined }))
    expect(store.getState().browserImportHintHidden).toBe(false)
  })
})

describe('createUISlice clearOsc52ClipboardDefaultOnNotice', () => {
  it('restores the armed notice from persisted UI', () => {
    const store = createUIStore()

    expect(store.getState().osc52ClipboardDefaultOnNoticePending).toBe(false)
    store
      .getState()
      .hydratePersistedUI(makePersistedUI({ osc52ClipboardDefaultOnNoticePending: true }))

    expect(store.getState().osc52ClipboardDefaultOnNoticePending).toBe(true)
  })

  it('stops the toast this session even when the persist fails', () => {
    // Why local-first: the flag is the only thing keeping the toast off screen, and a
    // rejected ui.set must not leave it re-firing on every render of this session. Losing
    // the persist just re-arms the notice next launch, which is the safe direction.
    const setUI = vi.fn(() => Promise.reject(new Error('runtime offline')))
    vi.stubGlobal('window', { api: { ui: { set: setUI } } })
    const store = createUIStore()
    store
      .getState()
      .hydratePersistedUI(makePersistedUI({ osc52ClipboardDefaultOnNoticePending: true }))

    store.getState().clearOsc52ClipboardDefaultOnNotice()

    expect(store.getState().osc52ClipboardDefaultOnNoticePending).toBe(false)
    expect(setUI).toHaveBeenCalledWith({ osc52ClipboardDefaultOnNoticePending: false })
  })
})
