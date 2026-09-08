import type { ChildProcessHandle as ChildProcess } from '../../shared/child-process/process-spec'
import {
  QUIT_RENDERER_ACK_TIMEOUT_MS,
  WILL_QUIT_TEARDOWN_DEADLINE_MS
} from '../../shared/quit-teardown-deadline'
import { serveSignalExitError } from './serve-signal-exit-diagnostic'

export const SERVE_CHILD_FORCE_KILL_SCHEDULING_MARGIN_MS = 5_000
export const SERVE_CHILD_FORCE_KILL_GRACE_MS =
  QUIT_RENDERER_ACK_TIMEOUT_MS +
  WILL_QUIT_TEARDOWN_DEADLINE_MS +
  SERVE_CHILD_FORCE_KILL_SCHEDULING_MARGIN_MS

/** Keeps the foreground `serve` child attached to its invoking shell and forwards shutdown signals. */
export function superviseForegroundServe(child: ChildProcess): Promise<number> {
  return new Promise((resolve, reject) => {
    const forwardsHangup = process.platform === 'linux'
    const forwardedSignals = new Set<NodeJS.Signals>()
    let forceKillTimer: ReturnType<typeof setTimeout> | null = null
    let settled = false

    const forwardSignal = (signal: NodeJS.Signals): void => {
      if (process.platform !== 'win32') {
        forwardedSignals.add(signal)
        child.kill(signal)
      }
      forceKillTimer ??= setTimeout(() => child.kill('SIGKILL'), SERVE_CHILD_FORCE_KILL_GRACE_MS)
    }
    const cleanup = (): void => {
      process.off('SIGINT', forwardSignal)
      process.off('SIGTERM', forwardSignal)
      if (forwardsHangup) {
        process.off('SIGHUP', forwardSignal)
      }
      if (forceKillTimer) {
        clearTimeout(forceKillTimer)
      }
    }
    const finish = (callback: () => void): void => {
      if (settled) {
        return
      }
      settled = true
      cleanup()
      callback()
    }

    process.on('SIGINT', forwardSignal)
    process.on('SIGTERM', forwardSignal)
    if (forwardsHangup) {
      process.on('SIGHUP', forwardSignal)
    }
    child.once('error', (error) => finish(() => reject(error)))
    child.once('exit', (code, signal) =>
      finish(() => {
        if (typeof code === 'number') {
          resolve(code)
          return
        }
        if (signal && forwardedSignals.has(signal)) {
          resolve(0)
          return
        }
        reject(serveSignalExitError(signal))
      })
    )
  })
}
