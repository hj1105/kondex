import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CrashReportRecord } from '../../shared/crash-reporting'

const { handlers, listeners, clipboardWriteTextMock, recordCrashBreadcrumbMock } = vi.hoisted(
  () => ({
    handlers: new Map<string, (_event: unknown, args?: unknown) => unknown>(),
    listeners: new Map<string, (_event: unknown, args?: unknown) => void>(),
    clipboardWriteTextMock: vi.fn(),
    recordCrashBreadcrumbMock: vi.fn()
  })
)

vi.mock('electron', () => ({
  app: { getVersion: () => '1.2.3-test' },
  clipboard: { writeText: clipboardWriteTextMock },
  ipcMain: {
    removeHandler: vi.fn((channel: string) => handlers.delete(channel)),
    handle: vi.fn((channel: string, handler: (_event: unknown, args?: unknown) => unknown) => {
      handlers.set(channel, handler)
    }),
    removeAllListeners: vi.fn((channel: string) => listeners.delete(channel)),
    on: vi.fn((channel: string, listener: (_event: unknown, args?: unknown) => void) => {
      listeners.set(channel, listener)
    })
  }
}))

vi.mock('../crash-reporting/crash-breadcrumb-store', () => ({
  getCrashBreadcrumbSnapshot: vi.fn(() => []),
  recordCoalescedCrashBreadcrumb: vi.fn(),
  recordCrashBreadcrumb: (...args: unknown[]) => recordCrashBreadcrumbMock(...args)
}))

import {
  _resetRendererErrorReportDedupeForTests,
  registerCrashReportingHandlers
} from './crash-reporting'

function report(
  status: CrashReportRecord['status'] = 'pending',
  id = 'crash-1'
): CrashReportRecord {
  return {
    id,
    createdAt: '2026-05-16T01:00:00.000Z',
    status,
    source: 'renderer',
    processType: 'renderer',
    reason: 'crashed',
    exitCode: 5,
    appVersion: '1.0.0',
    platform: process.platform,
    osRelease: 'test',
    arch: process.arch,
    electronVersion: '41',
    chromeVersion: '141',
    details: {}
  }
}

function crashStore(overrides: Record<string, unknown> = {}): never {
  return {
    getById: vi.fn(async () => null),
    dismiss: vi.fn(),
    listRecent: vi.fn(async () => []),
    record: vi.fn(),
    formatDiagnosticText: vi.fn(),
    ...overrides
  } as never
}

describe('registerCrashReportingHandlers', () => {
  beforeEach(() => {
    handlers.clear()
    listeners.clear()
    clipboardWriteTextMock.mockReset()
    recordCrashBreadcrumbMock.mockReset()
    _resetRendererErrorReportDedupeForTests()
  })

  it('keeps local crash diagnostics without exposing an upstream submission handler', async () => {
    const latest = report()
    registerCrashReportingHandlers(
      crashStore({
        getById: vi.fn(async () => latest),
        listRecent: vi.fn(async () => [latest])
      })
    )

    const result = await handlers.get('crashReports:copyLatestDiagnostics')?.(null, {
      reportId: latest.id,
      notes: 'extra /Users/alice/project'
    })

    expect(result).toEqual({ ok: true })
    expect(clipboardWriteTextMock).toHaveBeenCalledWith(expect.stringContaining('[Crash Report]'))
    expect(clipboardWriteTextMock).toHaveBeenCalledWith(
      expect.stringContaining('extra [redacted-path]')
    )
    expect(handlers.has('crashReports:submit')).toBe(false)
  })

  it('copies a local uncaptured report without selecting an older pending report', async () => {
    const listRecent = vi.fn(async () => [report('pending', 'crash-late-pending')])
    registerCrashReportingHandlers(crashStore({ listRecent }))

    const result = await handlers.get('crashReports:copyLatestDiagnostics')?.(null, {
      notes: 'after opening /Users/alice/project'
    })

    expect(result).toEqual({ ok: true })
    expect(clipboardWriteTextMock).toHaveBeenCalledWith(expect.stringContaining('not captured'))
    expect(clipboardWriteTextMock).toHaveBeenCalledWith(expect.stringContaining('[redacted-path]'))
    expect(listRecent).not.toHaveBeenCalled()
  })

  it('dismisses reports locally', async () => {
    const dismissed = report('dismissed', 'crash-dismiss')
    const dismiss = vi.fn(async () => dismissed)
    registerCrashReportingHandlers(crashStore({ dismiss }))

    await expect(
      handlers.get('crashReports:dismiss')?.(null, { reportId: dismissed.id })
    ).resolves.toEqual(dismissed)
    expect(dismiss).toHaveBeenCalledWith(dismissed.id)
  })

  it('records and deduplicates renderer error boundary reports', async () => {
    const recorded = report('pending', 'react-render')
    const recordMock = vi.fn(async () => recorded)
    registerCrashReportingHandlers(crashStore({ record: recordMock }))

    const args = {
      boundaryId: 'terminal.workbench',
      surface: 'terminal-workbench',
      errorName: 'TypeError',
      errorMessage: 'Cannot read /Users/alice/project/token=abc123',
      componentStack: 'at Terminal\nat App',
      activeView: 'terminal',
      activeTabType: 'terminal',
      hasActiveWorktree: true
    }

    await expect(handlers.get('crashReports:recordRendererError')?.(null, args)).resolves.toEqual({
      ok: true,
      report: recorded,
      deduped: false
    })
    await expect(handlers.get('crashReports:recordRendererError')?.(null, args)).resolves.toEqual({
      ok: true,
      report: null,
      deduped: true
    })
    expect(recordMock).toHaveBeenCalledTimes(1)
  })

  it('rejects invalid renderer error boundary surfaces', async () => {
    const recordMock = vi.fn()
    registerCrashReportingHandlers(crashStore({ record: recordMock }))

    await expect(
      handlers.get('crashReports:recordRendererError')?.(null, {
        boundaryId: 'terminal.workbench',
        surface: 'unknown',
        errorName: 'TypeError',
        errorMessage: 'nope'
      })
    ).resolves.toEqual({ ok: false, error: 'Invalid renderer error report.' })
    expect(recordMock).not.toHaveBeenCalled()
  })
})
