// Mapping from the renderer's `TuiAgent` union to the launch-context identity.
// Every shipped agent maps to a concrete value so reconnect and UI restoration
// can recover the provider without guessing.
//
// Lives in `src/shared/` (not the renderer) because main-side telemetry
// emission (`agent_started` from the `pty:spawn` IPC handler) needs the
// same mapping. Centralizing here means a new TuiAgent member is one edit,
// not a sweep across renderer + main.

import type { AgentKind } from './agent-launch-context'
import type { TuiAgent } from './tui-agent'

type ConcreteAgentKind = Exclude<AgentKind, 'other'>

const TUI_AGENT_KIND_BY_AGENT = {
  claude: 'claude-code',
  codex: 'codex'
} satisfies Record<TuiAgent, ConcreteAgentKind>

// Why: `satisfies Record<TuiAgent, …>` makes the lookup exhaustive at compile
// time, but stale persisted settings or unsafe IPC casts can carry a string
// outside the union at runtime — fall back to `'other'` so the event still
// emits instead of failing validation and dropping silently.
export function tuiAgentToAgentKind(agent: TuiAgent): AgentKind {
  return TUI_AGENT_KIND_BY_AGENT[agent] ?? 'other'
}

// Why: the worktree-initial-terminal launch path only carries `agent_kind`,
// not the TuiAgent. Reverse the map so that path can stamp the
// tab's launch agent without threading TuiAgent through every startup builder.
const AGENT_BY_TUI_AGENT_KIND: Partial<Record<AgentKind, TuiAgent>> = Object.fromEntries(
  Object.entries(TUI_AGENT_KIND_BY_AGENT).map(([agent, kind]) => [kind, agent as TuiAgent])
)

export function agentKindToTuiAgent(kind: AgentKind | null | undefined): TuiAgent | null {
  if (!kind) {
    return null
  }
  return AGENT_BY_TUI_AGENT_KIND[kind] ?? null
}
