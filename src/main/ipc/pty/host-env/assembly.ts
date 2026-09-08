import { join, delimiter } from 'node:path'
import { resolveSetupAgentSequenceLaunchCommand } from '../../../../shared/setup-agent-sequencing'
import { applyTerminalGitCredentialPromptGuard } from '../../terminal-git-credential-guard'
import { agentHookServer } from '../../../agent-hooks/server'
import { wslHookRelayManager } from '../../../agent-hooks/wsl-hook-relay-manager'
import { ensureLinuxTerminalOrcaCliShimDir } from '../../../cli/linux-terminal-orca-cli-shim'
import { stripLegacyTerminalShimEnv } from '../../../pty/legacy-terminal-shim-dir'
import { resolvePathEnvKey, mergePersistedWindowsPath } from '../../../pty/windows-environment-path'
import { resolveCodexShellLaunchPreflightCommand } from '../../../pty/codex-shell-launch-preflight'
import { buildConfiguredProxyEnv } from '../../../../shared/network-proxy'
import type { BuildPtyHostEnvOptions } from './types'
import { readInheritedPath } from './path'
import { stripInheritedOrcaCodexHomeOverride } from './codex-home'
import { AGENT_HOOK_RUNTIME_ENV_KEYS } from './spawn-env-keys'

/**
 * Mutates `baseEnv` in place with all host-local PTY env vars and returns it.
 *
 * Do NOT call when `args.connectionId` is set (SSH): every injection is host-loopback
 * or references local filesystem paths meaningless to a remote shell.
 */
export function buildPtyHostEnv(
  _id: string,
  baseEnv: Record<string, string>,
  opts: BuildPtyHostEnvOptions
): Record<string, string> {
  mergePersistedWindowsPath(baseEnv)
  Object.assign(baseEnv, buildConfiguredProxyEnv(opts.networkProxySettings))

  const launchCommandHint = resolveSetupAgentSequenceLaunchCommand(baseEnv, opts.launchCommand)

  // Why: unattended agents must fail instead of looping on OS credential prompts; user terminals keep normal Git behavior.
  applyTerminalGitCredentialPromptGuard(baseEnv, {
    launchCommand: launchCommandHint,
    isUnattended: opts.launchAgent !== undefined,
    deferGitConfigGuardToHost: opts.deferGitConfigGuardToDaemon
  })

  // Why: strip inherited hook coordinates before injecting this PTY's fresh loopback receiver, so nested-terminal callbacks route to the owning pane.
  for (const key of AGENT_HOOK_RUNTIME_ENV_KEYS) {
    delete baseEnv[key]
  }
  if (opts.agentStatusHooksEnabled) {
    Object.assign(baseEnv, agentHookServer.buildPtyEnv())
    if (opts.isWsl === true) {
      // Why: hook POSTs to 127.0.0.1 die inside WSL's NAT namespace; use the guest-resident relay's endpoint instead of the Windows one.
      const distro = opts.wslDistro ?? null
      wslHookRelayManager.ensureForDistro(distro, opts.selectedCodexHomePath)
      const guestEndpoint = wslHookRelayManager.getGuestEndpointFilePath(distro)
      if (guestEndpoint) {
        baseEnv.ORCA_AGENT_HOOK_ENDPOINT = guestEndpoint
      }
    }
  }

  // Why: keep the Codex home override PTY-scoped so dev/prod Orcas don't share hooks through ~/.codex.
  if (opts.skipCodexHomeEnv) {
    delete baseEnv.CODEX_HOME
    delete baseEnv.ORCA_CODEX_HOME
    delete baseEnv.ORCA_CODEX_LAUNCH_PREFLIGHT
  } else if (opts.selectedCodexHomePath) {
    baseEnv.CODEX_HOME = opts.selectedCodexHomePath
    // Why: user startup files may re-export CODEX_HOME; shell-ready wrappers restore this runtime home before Codex launches.
    baseEnv.ORCA_CODEX_HOME = opts.selectedCodexHomePath
    const preflightCommand = resolveCodexShellLaunchPreflightCommand({
      hooksEnabled: opts.codexStatusHooksEnabled ?? opts.agentStatusHooksEnabled,
      isPackaged: opts.isPackaged,
      isWsl: opts.isWsl,
      managedHomePath: opts.selectedCodexHomePath,
      userDataPath: opts.userDataPath,
      resourcesPath: opts.resourcesPath
    })
    if (preflightCommand) {
      baseEnv.ORCA_CODEX_LAUNCH_PREFLIGHT = preflightCommand
    } else {
      delete baseEnv.ORCA_CODEX_LAUNCH_PREFLIGHT
    }
  } else if (opts.stripInheritedOrcaCodexHome) {
    stripInheritedOrcaCodexHomeOverride(baseEnv)
    delete baseEnv.ORCA_CODEX_LAUNCH_PREFLIGHT
  } else {
    delete baseEnv.ORCA_CODEX_LAUNCH_PREFLIGHT
  }

  // Why: WSL shells need the managed userData root for shell-ready wrappers; dev-mode terminals need the same export so `orca` targets the live dev instance.
  if (opts.isWsl) {
    baseEnv.ORCA_USER_DATA_PATH = opts.userDataPath
    // ORCA_CLI_COMMAND remains a compatibility carrier for older hooks; its
    // value is the public Kondex command agents should actually execute.
    baseEnv.KONDEX_CLI_COMMAND = opts.isPackaged ? 'kondex' : 'kondex-dev'
    baseEnv.ORCA_CLI_COMMAND = baseEnv.KONDEX_CLI_COMMAND
  } else {
    if (!opts.isPackaged) {
      baseEnv.ORCA_USER_DATA_PATH ??= opts.userDataPath
    }
    baseEnv.KONDEX_CLI_COMMAND = opts.isPackaged ? 'kondex' : 'kondex-dev'
    baseEnv.ORCA_CLI_COMMAND = baseEnv.KONDEX_CLI_COMMAND
  }
  // Why: dev mode needs the launcher PATH override so `kondex` resolves to the
  // dev build instead of the production binary.
  if (!opts.isPackaged) {
    const devCliBin = join(opts.userDataPath, 'cli', 'bin')
    const inheritedPath = readInheritedPath(baseEnv)
    // Why: an empty PATH segment resolves as `.` in some shells (commands run from cwd); avoid a trailing delimiter.
    baseEnv[resolvePathEnvKey(baseEnv, process.platform)] = inheritedPath
      ? `${devCliBin}${delimiter}${inheritedPath}`
      : devCliBin
  } else if (process.platform === 'linux') {
    // AppImage sessions refresh a stable Kondex launcher under the profile.
    const shimDir = ensureLinuxTerminalOrcaCliShimDir({ userDataPath: opts.userDataPath })
    if (shimDir) {
      const inheritedEntries = readInheritedPath(baseEnv)
        .split(delimiter)
        .filter((entry) => entry.length > 0 && entry !== shimDir)
      baseEnv.PATH = [shimDir, ...inheritedEntries].join(delimiter)
    }
  } else if (
    opts.resourcesPath &&
    (process.platform === 'darwin' || process.platform === 'win32')
  ) {
    // Why: global CLI registration is optional, but agents in Kondex-managed PTYs must always reach this app's bundled CLI.
    const bundledCliBin = join(opts.resourcesPath, 'bin')
    const inheritedPath = readInheritedPath(baseEnv)
    baseEnv[resolvePathEnvKey(baseEnv, process.platform)] = inheritedPath
      ? `${bundledCliBin}${delimiter}${inheritedPath}`
      : bundledCliBin
  }

  if (
    opts.routeBrowserOpensToClient === true &&
    baseEnv.BROWSER === undefined &&
    process.env.BROWSER === undefined
  ) {
    const cliCommand = opts.isPackaged ? 'kondex' : 'kondex-dev'
    baseEnv.BROWSER = `${cliCommand} open-url --url %s`
  }

  // Why: must run after the prepends above — they re-read PATH from the unscrubbed
  // process.env when baseEnv carries none, which is the daemon path's normal shape.
  stripLegacyTerminalShimEnv(baseEnv, process.platform)

  return baseEnv
}
