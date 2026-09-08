import type { ClaudeRuntimeAuthPreparation } from '../claude-accounts/runtime-auth-service'
import { applyClaudeEnvPatch } from '../claude-accounts/environment'
import { parseWslUncPath } from '../../shared/wsl-paths'

export type CommitMessageAgentEnvironmentResolvers = {
  prepareForCodexLaunch?: (
    target?: CommitMessageAgentRuntimeTarget
  ) => string | null | Promise<string | null>
  prepareForClaudeLaunch?: (
    target?: CommitMessageAgentRuntimeTarget
  ) => Promise<ClaudeRuntimeAuthPreparation>
}

export type CommitMessageAgentRuntimeTarget = {
  runtime?: 'host' | 'wsl'
  wslDistro?: string | null
}

function cloneProcessEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      env[key] = value
    }
  }
  return env
}

// Why: with system-default real-home routing, the headless Codex commit run
// must use the user's own ~/.codex. If Orca itself was launched from a nested
// Orca terminal it can inherit an Orca-owned CODEX_HOME override; strip only
// that (CODEX_HOME matching the private ORCA_CODEX_HOME marker), preserving a
// user-set CODEX_HOME.
function cloneProcessEnvWithoutOrcaCodexHomeOverride(): Record<string, string> {
  const env = cloneProcessEnv()
  if (env.ORCA_CODEX_HOME && env.CODEX_HOME === env.ORCA_CODEX_HOME) {
    delete env.CODEX_HOME
  }
  delete env.ORCA_CODEX_HOME
  return env
}

export async function prepareLocalCommitMessageAgentEnv(
  agentId: string,
  resolvers: CommitMessageAgentEnvironmentResolvers | undefined,
  target?: CommitMessageAgentRuntimeTarget
): Promise<{ ok: true; env?: NodeJS.ProcessEnv } | { ok: false; error: string }> {
  if (!resolvers) {
    return { ok: true }
  }

  try {
    if (agentId === 'codex' && resolvers.prepareForCodexLaunch) {
      const codexHomePath = await resolvers.prepareForCodexLaunch(target)
      const wslCodexHome = codexHomePath ? parseWslUncPath(codexHomePath) : null
      if (target?.runtime === 'wsl') {
        const codexHomeForTarget = wslCodexHome?.linuxPath ?? null
        // Why: the fallback must still strip Orca-owned overrides, or a
        // system-default WSL run inherits the managed CODEX_HOME.
        return {
          ok: true,
          env: codexHomeForTarget
            ? { ...cloneProcessEnvWithoutOrcaCodexHomeOverride(), CODEX_HOME: codexHomeForTarget }
            : cloneProcessEnvWithoutOrcaCodexHomeOverride()
        }
      }
      if (codexHomePath && wslCodexHome) {
        // Why: this local generation path spawns the host Codex binary. A WSL
        // managed home is only valid when the process is routed through wsl.exe.
        return { ok: true }
      }
      return {
        ok: true,
        env: codexHomePath
          ? { ...cloneProcessEnv(), CODEX_HOME: codexHomePath }
          : cloneProcessEnvWithoutOrcaCodexHomeOverride()
      }
    }

    if (agentId === 'claude' && resolvers.prepareForClaudeLaunch) {
      const preparation = await resolvers.prepareForClaudeLaunch(target)
      const env = applyClaudeEnvPatch(cloneProcessEnv(), preparation.envPatch, {
        stripAuthEnv: preparation.stripAuthEnv
      })
      return { ok: true, env }
    }
  } catch (error) {
    console.error('[commit-message] Failed to prepare agent environment:', error)
    return {
      ok: false,
      error: 'Failed to prepare the selected agent account for commit message generation.'
    }
  }

  return { ok: true }
}
