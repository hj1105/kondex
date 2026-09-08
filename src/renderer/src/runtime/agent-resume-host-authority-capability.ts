import type { ResumableTuiAgent } from '../../../shared/agent-session-resume'
import type { TuiAgent } from '../../../shared/tui-agent'
import type { RuntimeCapability } from '../../../shared/protocol-version'

// Why: every agent added to RESUMABLE_TUI_AGENTS after agent-session.host-authority.v1 widens the
// host's ensureAgentSession enum. An older host answers the unknown member with invalid_argument,
// which runRemoteAgentSessionLaunch does not treat as a fallback signal, so the pane dies instead
// of degrading to a legacy launch. Probing the agent's own capability keeps version skew safe.
// The exhaustive Record makes the next RESUMABLE_TUI_AGENTS entry a compile error until its own
// gate — or a deliberate `undefined` — is declared here.
const RESUME_HOST_AUTHORITY_CAPABILITY_BY_AGENT = {
  // These shipped inside agent-session.host-authority.v1's enum, so the generic probe covers them.
  claude: undefined,
  codex: undefined
} satisfies Record<ResumableTuiAgent, RuntimeCapability | undefined>

export function agentResumeHostAuthorityCapability(
  agent: TuiAgent | null | undefined
): RuntimeCapability | undefined {
  if (!agent) {
    return undefined
  }
  return (
    RESUME_HOST_AUTHORITY_CAPABILITY_BY_AGENT as Partial<Record<TuiAgent, RuntimeCapability>>
  )[agent]
}
