import { app, ipcMain, shell } from 'electron'
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { arch as osArch, platform as osPlatform, release as osRelease, tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  collectDiagnosticBundle,
  getDiagnosticsStatus,
  type DiagnosticsStatus
} from '../observability'
import type { CollectedBundle } from '../observability/bundle'

export type DiagnosticsBundlePreview = Omit<CollectedBundle, 'payload'>

const PENDING_BUNDLE_TTL_MS = 15 * 60 * 1000
const MAX_PENDING_BUNDLES = 8

type PendingBundlePreview = {
  readonly createdAtMs: number
  readonly previewFilePath: string
  readonly ttlTimer: ReturnType<typeof setTimeout>
}

const pendingBundles = new Map<string, PendingBundlePreview>()

function isBundleId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(value)
}

function deletePreviewFile(filePath: string): void {
  try {
    if (existsSync(filePath)) {
      unlinkSync(filePath)
    }
  } catch {
    // Preview cleanup is best effort; failure must not break shutdown or settings.
  }
}

function deletePendingBundle(bundleId: string): void {
  const pending = pendingBundles.get(bundleId)
  if (!pending) {
    return
  }
  clearTimeout(pending.ttlTimer)
  deletePreviewFile(pending.previewFilePath)
  pendingBundles.delete(bundleId)
}

function prunePendingBundles(now = Date.now()): void {
  for (const [id, pending] of pendingBundles) {
    if (now - pending.createdAtMs > PENDING_BUNDLE_TTL_MS) {
      deletePendingBundle(id)
    }
  }
  while (pendingBundles.size > MAX_PENDING_BUNDLES) {
    const oldest = pendingBundles.keys().next().value as string | undefined
    if (!oldest) {
      break
    }
    deletePendingBundle(oldest)
  }
}

function getPreviewDirectory(): string {
  let base: string
  try {
    base = app.getPath('temp')
  } catch {
    base = tmpdir()
  }
  return join(base, 'kondex-diagnostic-bundle-previews')
}

function writeBundlePreviewFile(bundle: CollectedBundle): string {
  const previewDirectory = getPreviewDirectory()
  mkdirSync(previewDirectory, { mode: 0o700, recursive: true })
  const previewFilePath = join(previewDirectory, `${bundle.bundleId}.ndjson`)
  writeFileSync(previewFilePath, bundle.payload, { encoding: 'utf8', mode: 0o600 })
  return previewFilePath
}

function rememberBundle(bundle: CollectedBundle): void {
  deletePendingBundle(bundle.bundleId)
  const previewFilePath = writeBundlePreviewFile(bundle)
  const ttlTimer = setTimeout(() => deletePendingBundle(bundle.bundleId), PENDING_BUNDLE_TTL_MS)
  ttlTimer.unref?.()
  pendingBundles.set(bundle.bundleId, {
    createdAtMs: Date.now(),
    previewFilePath,
    ttlTimer
  })
  prunePendingBundles()
}

function getPendingPreviewFilePath(bundleId: unknown): string {
  if (!isBundleId(bundleId)) {
    throw new Error('bundleId has invalid format')
  }
  prunePendingBundles()
  const pending = pendingBundles.get(bundleId)
  if (!pending) {
    throw new Error('review file has expired; create a new one before opening')
  }
  return pending.previewFilePath
}

function discardPendingBundle(bundleId: unknown): void {
  if (!isBundleId(bundleId)) {
    throw new Error('bundleId has invalid format')
  }
  deletePendingBundle(bundleId)
}

export function registerDiagnosticsHandlers(): void {
  ipcMain.handle('diagnostics:getStatus', (): DiagnosticsStatus => getDiagnosticsStatus())

  ipcMain.handle(
    'diagnostics:collectBundle',
    (_event, lookbackMinutesIn: unknown): DiagnosticsBundlePreview => {
      if (!getDiagnosticsStatus().bundleEnabled) {
        throw new Error('creating review files is disabled')
      }
      const lookbackMinutes =
        typeof lookbackMinutesIn === 'number' && Number.isFinite(lookbackMinutesIn)
          ? Math.max(1, Math.min(30 * 24 * 60, Math.floor(lookbackMinutesIn)))
          : undefined
      const bundle = collectDiagnosticBundle({
        appVersion: app.getVersion(),
        platform: osPlatform(),
        arch: osArch(),
        osRelease: osRelease(),
        ...(lookbackMinutes !== undefined ? { lookbackMinutes } : {})
      })
      rememberBundle(bundle)
      const { payload: _payload, ...preview } = bundle
      return preview
    }
  )

  ipcMain.handle('diagnostics:openBundlePreview', async (_event, bundleId: unknown) => {
    const errorMessage = await shell.openPath(getPendingPreviewFilePath(bundleId))
    if (errorMessage) {
      throw new Error('could not open review file')
    }
  })

  ipcMain.handle('diagnostics:discardBundlePreview', (_event, bundleId: unknown) => {
    discardPendingBundle(bundleId)
  })
}
