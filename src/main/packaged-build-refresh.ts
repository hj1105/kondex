import { app, BrowserWindow } from 'electron'
import { stat } from 'node:fs/promises'
import { dirname } from 'node:path'

export const PACKAGED_BUILD_UPDATED_CHANNEL = 'app:packaged-build-updated'

type RefreshWindow = {
  isDestroyed(): boolean
  webContents: { send(channel: string): void }
}

type PackagedBuildRefreshOptions = {
  isPackaged?: boolean
  /** The bundle this process runs from; `app.getAppPath()` is the asar when packaged. */
  bundlePath?: string
  /** When this process started; a bundle written after that is a newer build. */
  startedAtMs?: number
  bundleModifiedAtMs?: (bundlePath: string) => Promise<number | null>
  getWindows?: () => RefreshWindow[]
  intervalMs?: number
  focusSource?: {
    on(event: 'browser-window-focus', listener: () => void): unknown
    off(event: 'browser-window-focus', listener: () => void): unknown
  }
  setInterval?: typeof globalThis.setInterval
  clearInterval?: typeof globalThis.clearInterval
}

const DEFAULT_INTERVAL_MS = 30_000

/** A build written after this process started is one the process is not running. */
export function isNewerBuild(bundleModifiedAtMs: number | null, startedAtMs: number): boolean {
  return bundleModifiedAtMs !== null && bundleModifiedAtMs > startedAtMs
}

/**
 * The path whose mtime says when the build was written. Never the asar itself:
 * Electron's fs patch answers a stat of an archive path with a synthetic Stats
 * whose mtime is "now", which reads as a build newer than every process and
 * made the restart offer reappear after each restart. The directory holding the
 * archive is a real filesystem entry that a rebuild rewrites.
 */
export function bundleMarkerPath(appPath: string): string {
  return appPath.endsWith('.asar') ? dirname(appPath) : appPath
}

async function modifiedAt(bundlePath: string): Promise<number | null> {
  try {
    return (await stat(bundlePath)).mtimeMs
  } catch {
    // Why: while a rebuild replaces the bundle the path is briefly absent; that is not a
    // new build yet, and the next check sees the finished one.
    return null
  }
}

/**
 * Tells every window once when the app bundle on disk is newer than the running
 * process, so a local `pnpm build:unpack` reaches the user as "restart to update"
 * instead of an app that silently keeps running last week's code. Replacing the
 * asar under a live process also breaks lazy chunk loads, so the prompt is not
 * cosmetic. Only packaged builds are watched; `pnpm dev` already hot-reloads.
 */
export function registerPackagedBuildRefresh(
  options: PackagedBuildRefreshOptions = {}
): () => void {
  const isPackaged = options.isPackaged ?? app.isPackaged
  if (!isPackaged) {
    return () => {}
  }
  const bundlePath = bundleMarkerPath(options.bundlePath ?? app.getAppPath())
  const startedAtMs = options.startedAtMs ?? Date.now() - process.uptime() * 1000
  const bundleModifiedAtMs = options.bundleModifiedAtMs ?? modifiedAt
  const getWindows = options.getWindows ?? (() => BrowserWindow.getAllWindows())
  const focusSource = options.focusSource ?? app
  const schedule = options.setInterval ?? setInterval
  const cancel = options.clearInterval ?? clearInterval
  let announced = false
  let checking = false

  const check = async (): Promise<void> => {
    if (announced || checking) {
      return
    }
    checking = true
    try {
      if (!isNewerBuild(await bundleModifiedAtMs(bundlePath), startedAtMs)) {
        return
      }
      announced = true
      for (const window of getWindows()) {
        if (!window.isDestroyed()) {
          window.webContents.send(PACKAGED_BUILD_UPDATED_CHANNEL)
        }
      }
      dispose()
    } finally {
      checking = false
    }
  }

  const onFocus = (): void => {
    void check()
  }
  const timer = schedule(() => void check(), options.intervalMs ?? DEFAULT_INTERVAL_MS)
  focusSource.on('browser-window-focus', onFocus)
  let disposed = false
  const dispose = (): void => {
    if (disposed) {
      return
    }
    disposed = true
    cancel(timer)
    focusSource.off('browser-window-focus', onFocus)
  }
  return dispose
}
