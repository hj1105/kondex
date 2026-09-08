// Composition root for local diagnostics. Wires the local NDJSON sink into the active tracer, and
// exposes a single init/shutdown pair the main process calls from
// `src/main/index.ts`.
//
// KONDEX_DIAGNOSTICS_DISABLED disables local files for policy-controlled machines;
// CI disables them to keep test runs hermetic. No diagnostics leave the machine.

import { createLocalFileSink, DEFAULT_MAX_FILES, type LocalFileSink } from './local-file-sink'
import { getDaemonLogFilePath, getTraceFilePath } from './logs-directory'
import { DAEMON_LOG_MAX_FILES } from '../daemon/daemon-file-log'
import {
  collectBundle as _collectBundle,
  type CollectBundleOptions,
  type CollectedBundle
} from './bundle'
import { setActiveSink } from './tracer'

const CI_ENV_VARS = [
  'CI',
  'GITHUB_ACTIONS',
  'GITLAB_CI',
  'CIRCLECI',
  'TRAVIS',
  'BUILDKITE',
  'JENKINS_URL',
  'TEAMCITY_VERSION'
] as const

export type ObservabilityConsent = {
  /** Whether the local NDJSON sink is active. */
  readonly localFileEnabled: boolean
  /** Whether the diagnostic-bundle button should be available. */
  readonly bundleEnabled: boolean
  /** Reason any of the lanes are disabled, for debug surfaces. */
  readonly disabledReason?: 'diagnostics_disabled' | 'ci'
}

function envOn(name: string): boolean {
  const v = process.env[name]
  if (!v) {
    return false
  }
  const norm = v.trim().toLowerCase()
  return norm === '1' || norm === 'true'
}

function inCI(): boolean {
  return CI_ENV_VARS.some((v) => process.env[v] !== undefined && process.env[v] !== '')
}

/** Resolve the per-launch consent state for this lane. Pure — reads only
 *  process.env, so callers can re-evaluate any time without holding state. */
export function resolveObservabilityConsent(): ObservabilityConsent {
  const diagnosticsDisabled = envOn('KONDEX_DIAGNOSTICS_DISABLED')
  const ci = inCI()

  if (ci) {
    return {
      localFileEnabled: false,
      bundleEnabled: false,
      disabledReason: 'ci'
    }
  }
  if (diagnosticsDisabled) {
    return {
      localFileEnabled: false,
      bundleEnabled: false,
      disabledReason: 'diagnostics_disabled'
    }
  }
  return {
    localFileEnabled: true,
    bundleEnabled: true
  }
}

// Re-exported so existing importers of the trace path keep working; the
// resolution now lives in one place alongside the daemon log path.
export { getTraceFilePath } from './logs-directory'

// ── Module-level state ───────────────────────────────────────────────────

let sink: LocalFileSink | null = null
let consent: ObservabilityConsent | null = null

/** Create the local file sink, install it as the active tracer sink, and
 *  update module-level `sink`. */
function installLocalSink(): void {
  const localSink = createLocalFileSink({ filePath: getTraceFilePath() })
  sink = localSink
  setActiveSink(localSink)
}

export function initObservability(): ObservabilityConsent {
  const c = resolveObservabilityConsent()
  consent = c
  if (!c.localFileEnabled) {
    // Disabled in CI or by KONDEX_DIAGNOSTICS_DISABLED — leave the
    // tracer's active sink unset, so all spans are no-ops.
    return c
  }
  installLocalSink()
  return c
}

export async function shutdownObservability(): Promise<void> {
  // Order matters: tracer first so no new pushes arrive while the local sink
  // is closing and flushing buffered lines.
  setActiveSink(null)
  if (sink) {
    sink.close()
    sink = null
  }
  consent = null
}

// ── Bundle / trace-folder operations exposed to IPC ─────────────────────

export type DiagnosticsStatus = {
  readonly bundleEnabled: boolean
  readonly disabledReason?: ObservabilityConsent['disabledReason']
}

export function getDiagnosticsStatus(): DiagnosticsStatus {
  const c = consent ?? resolveObservabilityConsent()
  return {
    bundleEnabled: c.bundleEnabled,
    ...(c.disabledReason ? { disabledReason: c.disabledReason } : {})
  }
}

/** Collect a bundle from the live trace folder. The `appVersion` /
 *  `platform` / `arch` / `osRelease` inputs come from main and are baked into
 *  the local review file header. */
export function collectDiagnosticBundle(
  meta: Pick<
    CollectBundleOptions,
    'appVersion' | 'platform' | 'arch' | 'osRelease' | 'lookbackMinutes'
  >
): CollectedBundle {
  // Flush the active sink first so the very latest spans are present in the
  // file when we read it back. Without this, the user's most-recent action
  // before creating the review file might miss the bundle by a few hundred ms — which
  // is exactly the case "the thing I just did" they want diagnosed.
  if (sink) {
    sink.flush()
  }
  return _collectBundle({
    traceFilePath: getTraceFilePath(),
    maxFiles: DEFAULT_MAX_FILES,
    // Why: the detached daemon writes its lifecycle log to a separate file, so
    // the bundle collector must be pointed at it explicitly — it does not glob
    // the logs directory.
    daemonLogFilePath: getDaemonLogFilePath(),
    daemonLogMaxFiles: DAEMON_LOG_MAX_FILES,
    ...meta
  })
}
