import type { RpcAnyMethod } from '../core'
import { STATUS_METHODS } from './status'
import { AI_VAULT_METHODS } from './ai-vault'
import { AUTOMATION_METHODS } from './automations'
import { REPO_METHODS } from './repo'
import { WORKTREE_METHODS } from './worktree'
import { TERMINAL_METHODS } from './terminal'
import { TERMINAL_ORPHAN_METHODS } from './terminal-orphan'
import { BROWSER_CORE_METHODS } from './browser-core'
import { BROWSER_EXTRA_METHODS } from './browser-extras'
import { BROWSER_SCREENCAST_METHODS } from './browser-screencast'
import { BROWSER_CLIENT_HOST_METHODS } from './browser-client-host'
import { BROWSER_CLIENT_FILE_CHANNEL_METHODS } from './browser-client-file-channel'
import { BROWSER_NETWORK_TUNNEL_METHODS } from './browser-network-tunnel'
import { ORCHESTRATION_METHODS } from './orchestration'
import { STATS_METHODS } from './stats'
import { DIAGNOSTICS_METHODS } from './diagnostics'
import { ACCOUNT_METHODS } from './accounts'
import { PREFLIGHT_METHODS } from './preflight'
import { COMPUTER_METHODS } from './computer'
import { SESSION_TAB_METHODS } from './session-tabs'
import { NATIVE_CHAT_METHODS } from './native-chat'
import { FILE_METHODS } from './files'
import { GIT_METHODS } from './git'
import { GITHUB_METHODS } from './github'
import { GITLAB_METHODS } from './gitlab'
import { HOSTED_REVIEW_METHODS } from './hosted-review'
import { SSH_METHODS } from './ssh'
import { CLIENT_UI_METHODS } from './client-ui'
import { CLIENT_EVENT_METHODS } from './client-events'
import { WORKSPACE_PORT_METHODS } from './workspace-ports'
import { PLUGIN_METHODS } from './plugins'
import { SKILL_METHODS } from './skills'
import { CLIPBOARD_METHODS } from './clipboard'
import { HOST_CAPABILITY_METHODS } from './host-capabilities'
import { EMULATOR_METHODS } from './emulator'
import { AGENT_SESSION_METHODS } from './agent-session'
import { STRUCTURED_AGENT_SESSION_METHODS } from './structured-agent-session'
import { AGENT_HOOK_METHODS } from './agent-hooks'
import { KONTEXT_METHODS } from './kontext'

// Why: a flat manifest keeps registration order explicit and provides one
// grep-point for "what methods does the RPC server expose?" — useful when
// auditing the security boundary or wiring new CLI commands.
export const ALL_RPC_METHODS: readonly RpcAnyMethod[] = [
  ...STATUS_METHODS,
  ...KONTEXT_METHODS,
  ...AGENT_HOOK_METHODS,
  ...AI_VAULT_METHODS,
  ...AUTOMATION_METHODS,
  ...REPO_METHODS,
  ...WORKTREE_METHODS,
  ...AGENT_SESSION_METHODS,
  ...STRUCTURED_AGENT_SESSION_METHODS,
  ...TERMINAL_METHODS,
  ...TERMINAL_ORPHAN_METHODS,
  ...BROWSER_CORE_METHODS,
  ...BROWSER_SCREENCAST_METHODS,
  ...BROWSER_EXTRA_METHODS,
  ...BROWSER_CLIENT_HOST_METHODS,
  ...BROWSER_CLIENT_FILE_CHANNEL_METHODS,
  ...BROWSER_NETWORK_TUNNEL_METHODS,
  ...ORCHESTRATION_METHODS,
  ...STATS_METHODS,
  ...DIAGNOSTICS_METHODS,
  ...ACCOUNT_METHODS,
  ...PREFLIGHT_METHODS,
  ...COMPUTER_METHODS,
  ...SESSION_TAB_METHODS,
  ...NATIVE_CHAT_METHODS,
  ...FILE_METHODS,
  ...GIT_METHODS,
  ...GITHUB_METHODS,
  ...GITLAB_METHODS,
  ...HOSTED_REVIEW_METHODS,
  ...SSH_METHODS,
  ...WORKSPACE_PORT_METHODS,
  ...PLUGIN_METHODS,
  ...SKILL_METHODS,
  ...CLIPBOARD_METHODS,
  ...HOST_CAPABILITY_METHODS,
  ...CLIENT_EVENT_METHODS,
  ...CLIENT_UI_METHODS,
  ...EMULATOR_METHODS
]
