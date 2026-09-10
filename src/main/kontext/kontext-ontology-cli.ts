import { stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { runProcess } from '../../shared/child-process/run-process'
import { resolveKontextSidecarPath } from './kontext-sidecar-path'
import { hydrateShellPath, mergePathSegments } from '../startup/hydrate-shell-path'

/**
 * Locates and runs the `kontext-ontology` CLI that ships with the same Kontext
 * Brain checkout as the sidecar. Ontology setup is not a sidecar capability —
 * the sidecar bundle is built from the Task tool server — so the host runs the
 * CLI rather than pretending the sidecar can answer for it.
 */

/** From `<checkout>/plugins/kontext-brain/server.mjs` up to `<checkout>`. */
const SIDECAR_DEPTH_FROM_CHECKOUT = 3
const CLI_RELATIVE_PATH = ['packages', 'loader', 'dist', 'ontology-cli-main.js'] as const
/** Setup drives a model over every collected document; a short cap would kill real work. */
// Why: a build over an organization's code runs dozens of model batches; a short cap
// reported that as a hang while the CLI was still, correctly, working.
const COMMAND_TIMEOUT_MS = 60 * 60 * 1000

export type KontextOntologyCliResolution =
  | { status: 'configured'; path: string }
  | { status: 'not_configured'; reason: string }

function checkoutRootOf(sidecarPath: string): string {
  let directory = sidecarPath
  for (let step = 0; step < SIDECAR_DEPTH_FROM_CHECKOUT; step += 1) {
    directory = dirname(directory)
  }
  return directory
}

const BUNDLED_CLI_NAME = 'ontology-cli.mjs'

/**
 * Order: an explicit override, the single-file CLI packaged beside the sidecar
 * (the only thing a packaged app has), that same file beside a configured
 * sidecar, and finally the built CLI in a source checkout for `pnpm dev`.
 */
export async function resolveKontextOntologyCli(options: {
  resourcesPath?: string
  environment?: NodeJS.ProcessEnv
}): Promise<KontextOntologyCliResolution> {
  const environment = options.environment ?? process.env
  const override = environment.KONDEX_KONTEXT_ONTOLOGY_CLI?.trim()
  if (override) {
    return inspect(resolve(override))
  }
  if (options.resourcesPath) {
    const packaged = await inspect(join(options.resourcesPath, 'kontext', BUNDLED_CLI_NAME))
    if (packaged.status === 'configured') {
      return packaged
    }
  }
  const sidecar = await resolveKontextSidecarPath(options)
  if (sidecar.status !== 'configured') {
    return {
      status: 'not_configured',
      reason: 'No Kontext Brain checkout is configured for this host.'
    }
  }
  const beside = await inspect(join(dirname(sidecar.path), BUNDLED_CLI_NAME))
  if (beside.status === 'configured') {
    return beside
  }
  return inspect(join(checkoutRootOf(sidecar.path), ...CLI_RELATIVE_PATH))
}

async function inspect(candidate: string): Promise<KontextOntologyCliResolution> {
  try {
    const candidateStat = await stat(candidate)
    if (!candidateStat.isFile()) {
      return { status: 'not_configured', reason: `${candidate} is not a file` }
    }
    return { status: 'configured', path: candidate }
  } catch {
    // Why: the CLI is a build output. Saying it is missing is more useful than
    // saying the checkout is wrong, because the fix is to build the package.
    return {
      status: 'not_configured',
      reason: `${candidate} is missing. Build it with: pnpm --filter @kontext-brain/loader build`
    }
  }
}

/** Electron sets this on every process it starts; plain Node (tests, scripts) has none. */
function electronResourcesPath(): string | undefined {
  const value = (process as NodeJS.Process & { resourcesPath?: unknown }).resourcesPath
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

export class KontextOntologyCliError extends Error {
  override readonly name = 'KontextOntologyCliError'
}

export async function runKontextOntologyCommand(options: {
  args: readonly string[]
  workspacePath: string
  resourcesPath?: string
  environment?: NodeJS.ProcessEnv
  signal?: AbortSignal
}): Promise<{ exitCode: number; output: string; stdout: string; cliPath: string }> {
  const resourcesPath = options.resourcesPath ?? electronResourcesPath()
  const resolution = await resolveKontextOntologyCli({
    ...(resourcesPath === undefined ? {} : { resourcesPath }),
    ...(options.environment === undefined ? {} : { environment: options.environment })
  })
  if (resolution.status !== 'configured') {
    throw new KontextOntologyCliError(resolution.reason)
  }
  // Why: launched from the Dock, the app inherits a PATH without Homebrew, so the CLI
  // would miss the user's gh and git even though their terminal has both.
  if (options.environment === undefined) {
    const hydration = await hydrateShellPath()
    if (hydration.ok) {
      mergePathSegments(hydration.segments)
    }
  }
  const result = await runProcess({
    program: process.execPath,
    args: [resolution.path, ...options.args],
    cwd: options.workspacePath,
    // Why: Electron's own binary is the Node runtime here, so it has to be told
    // to behave as Node rather than boot a second application window.
    env: { ...(options.environment ?? process.env), ELECTRON_RUN_AS_NODE: '1' },
    timeoutMs: COMMAND_TIMEOUT_MS,
    ...(options.signal ? { signal: options.signal } : {})
  })
  const output = [result.stdout, result.stderr].filter((part) => part.trim() !== '').join('\n')
  if (result.timedOut) {
    throw new KontextOntologyCliError('The ontology command did not finish before its time limit.')
  }
  return { exitCode: result.code ?? 1, output, stdout: result.stdout, cliPath: resolution.path }
}

/**
 * Runs a command in `--json` mode and returns its parsed result. A non-zero exit
 * is still a result the CLI describes, so only unparseable output is an error —
 * reporting a checked failure as a crash would hide which source is unreachable.
 */
export async function runKontextOntologyJson(options: {
  args: readonly string[]
  workspacePath: string
  resourcesPath?: string
  environment?: NodeJS.ProcessEnv
  signal?: AbortSignal
}): Promise<unknown> {
  const result = await runKontextOntologyCommand({ ...options, args: [...options.args, '--json'] })
  try {
    // Why: only stdout carries the result. Node writes deprecation and TLS warnings to
    // stderr, and merging them in turns every command into a parse failure.
    return JSON.parse(result.stdout)
  } catch {
    const detail = result.output.trim()
    throw new KontextOntologyCliError(
      detail === '' ? 'The ontology command produced no output.' : detail
    )
  }
}
