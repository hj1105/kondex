import os from 'node:os'
import { app, clipboard, ipcMain } from 'electron'
import {
  type CrashReportCopyDiagnosticsArgs,
  formatCrashReportText,
  formatUncapturedCrashReportText
} from '../../shared/crash-reporting'
import type { CrashReportStore } from '../crash-reporting/crash-report-store'
import { rendererCrashBreadcrumbOrigin } from '../../shared/crash-breadcrumb-origin'
import {
  assertClipboardTextWriteWithinLimit,
  isClipboardTextWriteTooLargeError
} from '../../shared/clipboard-text'
import {
  recentRendererErrorReportKeys,
  recordRendererErrorReport
} from './crash-reporting-renderer-error-report'
import { recordRendererBreadcrumbFromRenderer } from './crash-reporting-renderer-breadcrumbs'
import {
  getLatestPendingReport,
  getLatestReviewableReport,
  getRequestedCrashReport
} from './crash-reporting-local-reports'

export function _resetRendererErrorReportDedupeForTests(): void {
  recentRendererErrorReportKeys.clear()
}

function buildUncapturedCrashReportText(notes: string | undefined): string {
  return formatUncapturedCrashReportText(
    {
      createdAt: new Date().toISOString(),
      appVersion: app.getVersion(),
      platform: os.platform(),
      osRelease: os.release(),
      arch: os.arch(),
      electronVersion: process.versions.electron ?? 'unknown',
      chromeVersion: process.versions.chrome ?? 'unknown'
    },
    notes
  )
}

export function registerCrashReportingHandlers(store: CrashReportStore): void {
  ipcMain.removeHandler('crashReports:getLatestPending')
  ipcMain.handle('crashReports:getLatestPending', () => getLatestPendingReport(store))

  ipcMain.removeHandler('crashReports:getLatestReport')
  ipcMain.handle('crashReports:getLatestReport', () => getLatestReviewableReport(store))

  ipcMain.removeHandler('crashReports:dismiss')
  ipcMain.handle('crashReports:dismiss', async (_event, args: { reportId: string }) => {
    return store.dismiss(args.reportId)
  })

  ipcMain.removeAllListeners('crashReports:recordBreadcrumb')
  ipcMain.on(
    'crashReports:recordBreadcrumb',
    (event, args?: { name?: unknown; data?: unknown }) => {
      const senderId = event?.sender?.id
      recordRendererBreadcrumbFromRenderer(
        args,
        typeof senderId === 'number' ? rendererCrashBreadcrumbOrigin(senderId) : undefined
      )
    }
  )

  ipcMain.removeHandler('crashReports:copyLatestDiagnostics')
  ipcMain.handle(
    'crashReports:copyLatestDiagnostics',
    async (_event, args?: CrashReportCopyDiagnosticsArgs) => {
      const report = await getRequestedCrashReport(store, args)
      const baseText = report
        ? formatCrashReportText(report, args?.notes)
        : buildUncapturedCrashReportText(args?.notes)
      try {
        clipboard.writeText(assertClipboardTextWriteWithinLimit(baseText))
      } catch (error) {
        if (isClipboardTextWriteTooLargeError(error)) {
          return { ok: false as const, error: 'Crash diagnostics are too large to copy safely.' }
        }
        throw error
      }
      return { ok: true as const }
    }
  )

  ipcMain.removeHandler('crashReports:recordRendererError')
  ipcMain.handle('crashReports:recordRendererError', async (event, args: unknown) => {
    try {
      return await recordRendererErrorReport(store, args, event?.sender?.id)
    } catch (error) {
      console.error('[crash-reporting] Failed to record renderer error report:', error)
      return { ok: false, error: 'Failed to record renderer error report.' }
    }
  })
}
