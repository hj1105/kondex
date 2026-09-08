import type { AgentHookInstallStatus, AgentHookTarget } from '../../shared/agent-hook-types'
import { claudeHookService } from '../claude/hook-service'
import { codexHookService } from '../codex/hook-service'

// Why (#16441): Codex's installer awaits a codex app-server trust-grant session
// instead of blocking the main thread on spawnSync. Widening the tuple keeps the
// Claude's service synchronous — the shared loop already awaits.
export type ManagedAgentHookInstallOptions = { userInitiated?: boolean }
export type ManagedAgentHookInstaller = readonly [
  AgentHookTarget,
  (
    options?: ManagedAgentHookInstallOptions
  ) => AgentHookInstallStatus | Promise<AgentHookInstallStatus>
]
export type ManagedAgentHookScriptRefresher = readonly [AgentHookTarget, () => Promise<void>]
export type ManagedAgentHookRemover = readonly [
  AgentHookTarget,
  () => AgentHookInstallStatus | Promise<AgentHookInstallStatus>
]
export type ManagedAgentHookAsyncRemover = readonly [
  AgentHookTarget,
  () => Promise<AgentHookInstallStatus>
]
export type ManagedAgentHookStatusReader = readonly [AgentHookTarget, () => AgentHookInstallStatus]

export const MANAGED_AGENT_HOOK_INSTALLERS: readonly ManagedAgentHookInstaller[] = [
  ['claude', () => claudeHookService.install()],
  ['codex', () => codexHookService.install()]
]

// Why: covers the shared launcher/statusline scripts under ~/.orca/agent-hooks — the files a
// user-wide agent config keeps invoking after the CLI falls off PATH. Enforced by the coverage test in
// managed-hook-script-refresh.test.ts: a new installer that writes a launcher without adding
// a refresher here fails that test.
export const MANAGED_AGENT_HOOK_SCRIPT_REFRESHERS: readonly ManagedAgentHookScriptRefresher[] = [
  ['claude', () => claudeHookService.refreshManagedScripts()],
  ['codex', () => codexHookService.refreshManagedScripts()]
]

export const MANAGED_AGENT_HOOK_REMOVERS: readonly ManagedAgentHookRemover[] = [
  ['claude', () => claudeHookService.remove()],
  ['codex', () => codexHookService.remove()]
]

export const MANAGED_AGENT_HOOK_ASYNC_REMOVERS: readonly ManagedAgentHookAsyncRemover[] = []

export const MANAGED_AGENT_HOOK_STATUS_READERS: readonly ManagedAgentHookStatusReader[] = [
  ['claude', () => claudeHookService.getStatus()],
  ['codex', () => codexHookService.getStatus()]
]
