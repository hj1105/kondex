import { spawn as spawnProcess, type SpawnOptions } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { runProcessSync } from '../../shared/child-process/run-process'
import { getMacAppBundlePath } from './mac-app-bundle'
import { superviseForegroundServe } from './serve-process-supervisor'
import { RuntimeClientError } from './types'

const USER_NAMESPACE_PROBE_TIMEOUT_MS = 2_000

export function launchOrcaApp(): void {
  const overrideCommand = process.env.ORCA_OPEN_COMMAND
  if (typeof overrideCommand === 'string' && overrideCommand.trim().length > 0) {
    spawnDetached(overrideCommand, [], { shell: true })
    return
  }

  const overrideExecutable = process.env.ORCA_APP_EXECUTABLE
  if (typeof overrideExecutable === 'string' && overrideExecutable.trim().length > 0) {
    spawnDetached(overrideExecutable, getExecutableAppArgs(overrideExecutable), {
      ...getExecutableSpawnOptions(overrideExecutable),
      env: stripElectronRunAsNode(process.env)
    })
    return
  }

  if (process.env.ELECTRON_RUN_AS_NODE === '1') {
    if (process.platform === 'darwin') {
      const appBundlePath = getMacAppBundlePath(process.execPath)
      if (appBundlePath) {
        // Why: launching the inner MacOS binary directly can trigger macOS app
        // launch failures and bypass normal bundle lifecycle. The public
        // packaged CLI should re-open the .app the same way Finder does.
        spawnDetached('open', [appBundlePath], {
          env: stripElectronRunAsNode(process.env)
        })
        return
      }
    }

    spawnDetached(process.execPath, getExecutableAppArgs(process.execPath), {
      env: stripElectronRunAsNode(process.env)
    })
    return
  }

  throw new RuntimeClientError(
    'runtime_open_failed',
    'Could not determine how to launch Kondex. Start Kondex manually and try again.'
  )
}

function spawnDetached(command: string, args: string[], options: SpawnOptions): void {
  const child = spawnProcess(command, args, {
    detached: true,
    stdio: 'ignore',
    ...options
  })
  // Why: detached launch errors are reported asynchronously after this function
  // returns; openOrca already reports the user-facing timeout if startup fails.
  child.once('error', () => {})
  child.unref()
}

export function serveOrcaApp(
  args: {
    json?: boolean
    port?: string | null
    pairingAddress?: string | null
    noPairing?: boolean
  } = {}
): Promise<number> {
  const executable = resolveForegroundOrcaExecutable()
  const childArgs = [...getExecutableAppArgs(executable)]
  childArgs.push('--serve')
  if (args.json) {
    childArgs.push('--serve-json')
  }
  if (args.port) {
    childArgs.push('--serve-port', args.port)
  }
  if (args.pairingAddress) {
    childArgs.push('--serve-pairing-address', args.pairingAddress)
  }
  if (args.noPairing) {
    childArgs.push('--serve-no-pairing')
  }
  const childEnv = stripElectronRunAsNode(process.env)
  const spawnOptions: SpawnOptions = {
    detached: false,
    cwd: resolveAppRoot(),
    stdio: 'inherit',
    ...getExecutableSpawnOptions(executable),
    env: childEnv
  }
  const child = spawnProcess(executable, childArgs, spawnOptions)

  return superviseForegroundServe(child)
}

function getExecutableAppArgs(executable: string): string[] {
  const args = process.env.ORCA_APP_EXECUTABLE_NEEDS_APP_ROOT === '1' ? [resolveAppRoot()] : []
  if (shouldDisableExtractedAppImageSandbox(executable)) {
    args.push('--no-sandbox')
  }
  return args
}

function shouldDisableExtractedAppImageSandbox(executable: string): boolean {
  if (process.platform !== 'linux' || !existsSync(join(dirname(executable), 'AppRun'))) {
    return false
  }
  // An extracted AppImage has no root-owned setuid sandbox; mirror AppRun's userns fallback.
  if (process.getuid?.() === 0) {
    return true
  }
  try {
    return (
      runProcessSync({
        program: 'unshare',
        args: ['-Ur', 'true'],
        stdio: 'ignore',
        timeoutMs: USER_NAMESPACE_PROBE_TIMEOUT_MS
      }).code !== 0
    )
  } catch {
    return true
  }
}

function getExecutableSpawnOptions(executable: string): Pick<SpawnOptions, 'shell'> {
  return process.platform === 'win32' && /\.(?:cmd|bat)$/i.test(executable) ? { shell: true } : {}
}

function resolveAppRoot(): string {
  // Why: dev-mode resource resolution in the Electron child may consult
  // process.cwd(). Pin it to the app root so `kondex serve` behaves the same
  // regardless of the shell directory it was launched from.
  return resolve(__dirname, '../../..')
}

function resolveForegroundOrcaExecutable(): string {
  const overrideExecutable = process.env.ORCA_APP_EXECUTABLE
  if (typeof overrideExecutable === 'string' && overrideExecutable.trim().length > 0) {
    return overrideExecutable
  }
  if (process.env.ELECTRON_RUN_AS_NODE === '1') {
    return process.execPath
  }
  throw new RuntimeClientError(
    'runtime_serve_failed',
    'Could not determine how to start Kondex server. Set ORCA_APP_EXECUTABLE to the Kondex executable.'
  )
}

export function stripElectronRunAsNode(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const next = { ...env }
  delete next.ELECTRON_RUN_AS_NODE
  return next
}
