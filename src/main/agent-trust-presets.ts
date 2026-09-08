import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { getOrcaManagedCodexHomePath } from './codex/codex-home-paths'
import { upsertProjectTrustLevel } from './codex/config-toml-trust'
import { runExclusivelyForCodexTrustConfig } from './codex/codex-trust-config-mutation-queue'

export type AgentTrustPreset = 'codex'

/**
 * Pre-mark a workspace as trusted for Codex so the agent's "Do you trust this
 * folder?" menu does not fire on
 * first launch.
 *
 * Why: Orca's "drop URL into agent input as a draft" flow injects the URL
 * via bracketed-paste once the TUI is up. If the trust menu intercepts the
 * keystrokes (each menu reads a single character or numbered option), the
 * paste either selects an arbitrary option or quits the session. Pre-writing
 * the same trust artifact that the agent writes after the user accepts is
 * the supported bypass. Codex's `--dangerously-bypass-approvals-and-sandbox`
 * would also change
 * approval/sandbox policy, so it is not equivalent to "trust this project".
 */

/**
 * Codex stores project trust in ~/.codex/config.toml under:
 *   [projects."<realpath>"]
 *   trust_level = "trusted"
 *
 * Verified against codex-rs/tui/src/onboarding/trust_directory.rs and
 * codex-rs/core/src/config/config_tests.rs in the Codex CLI source.
 */
export function markCodexProjectTrusted(workspacePath: string): Promise<void> {
  const absPath = resolveCodexProjectTrustRoot(workspacePath)
  const systemTomlPath = join(homedir(), '.codex', 'config.toml')
  // Why: Orca-launched Codex runs with an Orca-owned CODEX_HOME, so the trust
  // preset must also update the runtime config Codex will actually read.
  const runtimeTomlPath = join(getOrcaManagedCodexHomePath(), 'config.toml')
  // Why (#16441): hook installs now await a codex app-server grant, so an
  // unqueued write here can land inside their capture->restore window and be
  // reverted. Same runtime-before-system lock order the installer takes.
  return runExclusivelyForCodexTrustConfig(runtimeTomlPath, () =>
    runExclusivelyForCodexTrustConfig(systemTomlPath, async () => {
      upsertProjectTrustLevel(systemTomlPath, absPath, 'trusted')
      upsertProjectTrustLevel(runtimeTomlPath, absPath, 'trusted')
    })
  )
}

function resolveCodexProjectTrustRoot(workspacePath: string): string {
  const absPath = canonicalize(workspacePath)
  try {
    const gitDirReference = readFileSync(join(absPath, '.git'), 'utf-8').trim()
    if (!gitDirReference.startsWith('gitdir:')) {
      return absPath
    }
    const gitDirPath = gitDirReference.slice('gitdir:'.length).trim()
    if (!gitDirPath) {
      return absPath
    }
    const gitDir = resolve(absPath, gitDirPath)
    const worktreesDir = dirname(gitDir)
    if (basename(worktreesDir) !== 'worktrees') {
      return absPath
    }
    // Why: workspace-controlled .git metadata must not broaden trust without Git's reciprocal link.
    const gitDirBacklink = readFileSync(join(gitDir, 'gitdir'), 'utf-8').trim()
    if (!gitDirBacklink) {
      return absPath
    }
    const resolvedBacklink = resolve(gitDir, gitDirBacklink)
    const workspaceGitFile = join(absPath, '.git')
    if (
      resolvedBacklink !== workspaceGitFile &&
      canonicalize(resolvedBacklink) !== canonicalize(workspaceGitFile)
    ) {
      return absPath
    }
    // Why: mirror Codex's validated .git/worktrees/<name> traversal instead of trusting arbitrary commondir contents.
    return canonicalize(dirname(dirname(worktreesDir)))
  } catch {
    return absPath
  }
}

function canonicalize(p: string): string {
  // Why: a worktree under a symlinked parent must match Codex's canonical path lookup.
  try {
    if (existsSync(p)) {
      return realpathSync.native(p)
    }
  } catch {
    // Fall through to the raw input.
  }
  return p
}
