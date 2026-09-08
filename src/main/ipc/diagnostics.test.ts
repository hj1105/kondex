import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CollectedBundle } from '../observability/bundle'

const handlers = new Map<string, (_event: unknown, ...args: unknown[]) => unknown>()

const {
  handleMock,
  mkdirSyncMock,
  writeFileSyncMock,
  existsSyncMock,
  unlinkSyncMock,
  openPathMock,
  collectDiagnosticBundleMock,
  getDiagnosticsStatusMock
} = vi.hoisted(() => ({
  handleMock: vi.fn(),
  mkdirSyncMock: vi.fn(),
  writeFileSyncMock: vi.fn(),
  existsSyncMock: vi.fn(() => true),
  unlinkSyncMock: vi.fn(),
  openPathMock: vi.fn(() => Promise.resolve('')),
  collectDiagnosticBundleMock: vi.fn(),
  getDiagnosticsStatusMock: vi.fn()
}))

vi.mock('node:fs', () => ({
  existsSync: existsSyncMock,
  mkdirSync: mkdirSyncMock,
  unlinkSync: unlinkSyncMock,
  writeFileSync: writeFileSyncMock
}))

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp', getVersion: () => '1.2.3-test' },
  ipcMain: { handle: handleMock },
  shell: { openPath: openPathMock }
}))

vi.mock('../observability', () => ({
  collectDiagnosticBundle: collectDiagnosticBundleMock,
  getDiagnosticsStatus: getDiagnosticsStatusMock
}))

import { registerDiagnosticsHandlers } from './diagnostics'

function makeBundle(overrides: Partial<CollectedBundle> = {}): CollectedBundle {
  return {
    bundleId: 'bundleabcdefghijklmnop',
    payload: '{"type":"bundle-header"}\n',
    bytes: 25,
    spanCount: 0,
    ...overrides
  }
}

describe('local diagnostics IPC handlers', () => {
  beforeEach(() => {
    handlers.clear()
    handleMock.mockReset()
    mkdirSyncMock.mockReset()
    writeFileSyncMock.mockReset()
    existsSyncMock.mockReset()
    existsSyncMock.mockReturnValue(true)
    unlinkSyncMock.mockReset()
    openPathMock.mockReset()
    openPathMock.mockResolvedValue('')
    collectDiagnosticBundleMock.mockReset()
    collectDiagnosticBundleMock.mockReturnValue(makeBundle())
    getDiagnosticsStatusMock.mockReset()
    getDiagnosticsStatusMock.mockReturnValue({
      bundleEnabled: true
    })
    registerDiagnosticsHandlers()
    for (const [channel, handler] of handleMock.mock.calls) {
      handlers.set(channel as string, handler as (event: unknown, ...args: unknown[]) => unknown)
    }
  })

  it('registers no network submission channels', () => {
    expect([...handlers.keys()].sort()).toEqual([
      'diagnostics:collectBundle',
      'diagnostics:discardBundlePreview',
      'diagnostics:getStatus',
      'diagnostics:openBundlePreview'
    ])
  })

  it('writes a private local preview and returns metadata without payload bytes', () => {
    const preview = handlers.get('diagnostics:collectBundle')!({}, 30)

    expect(mkdirSyncMock).toHaveBeenCalledWith('/tmp/kondex-diagnostic-bundle-previews', {
      mode: 0o700,
      recursive: true
    })
    expect(writeFileSyncMock).toHaveBeenCalledWith(
      '/tmp/kondex-diagnostic-bundle-previews/bundleabcdefghijklmnop.ndjson',
      makeBundle().payload,
      { encoding: 'utf8', mode: 0o600 }
    )
    expect(preview).toEqual({
      bundleId: 'bundleabcdefghijklmnop',
      bytes: 25,
      spanCount: 0
    })
  })

  it('opens and discards only a main-created preview', async () => {
    handlers.get('diagnostics:collectBundle')!({}, 30)
    await handlers.get('diagnostics:openBundlePreview')!({}, 'bundleabcdefghijklmnop')
    handlers.get('diagnostics:discardBundlePreview')!({}, 'bundleabcdefghijklmnop')

    expect(openPathMock).toHaveBeenCalledWith(
      '/tmp/kondex-diagnostic-bundle-previews/bundleabcdefghijklmnop.ndjson'
    )
    expect(unlinkSyncMock).toHaveBeenCalledWith(
      '/tmp/kondex-diagnostic-bundle-previews/bundleabcdefghijklmnop.ndjson'
    )
  })

  it('refuses collection when local diagnostic bundles are disabled', () => {
    getDiagnosticsStatusMock.mockReturnValue({
      bundleEnabled: false,
      disabledReason: 'diagnostics_disabled'
    })

    expect(() => handlers.get('diagnostics:collectBundle')!({}, 30)).toThrow(
      'creating review files is disabled'
    )
  })
})
