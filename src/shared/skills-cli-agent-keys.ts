import type { TuiAgent } from './tui-agent'

/**
 * The community `skills` CLI's own `--agent` key for each supported agent.
 *
 * Why: `skills add` validates `--agent` against its own namespace and exits 1 on
 * an unknown key, so this mapping remains explicit.
 */
export const SKILLS_CLI_AGENT_KEY_BY_TUI_AGENT = {
  claude: 'claude-code',
  codex: 'codex'
} satisfies Record<TuiAgent, string | null>

/**
 * The shared `.agents/skills` target every universal agent reads. Always included
 * so agents Orca cannot map still receive the skill.
 */
export const SKILLS_CLI_UNIVERSAL_AGENT_KEY = 'universal'

/**
 * Whether a value is shaped like a `skills --agent` key, or its explicit all-agents
 * wildcard.
 *
 * Why: the skills CLI silently DROPS a `--agent` value that starts with `-`, which
 * empties its target list and drops it into the same all-agents branch an omitted
 * --agent does. `--agent -y` is enough to trigger it, so shape is checked, not just
 * emptiness. An unknown-but-plausible key is left to the CLI, which rejects it
 * loudly with its own valid list before writing anything.
 */
export function isSkillsCliAgentKeyShaped(value: string): boolean {
  return /^(?:\*|[a-z0-9][a-z0-9.-]*)$/i.test(value)
}

/** Map detected Orca agents onto `skills --agent` keys, plus the universal target. */
export function toSkillsCliAgentKeys(detectedAgents: readonly TuiAgent[]): string[] {
  const keys = new Set<string>([SKILLS_CLI_UNIVERSAL_AGENT_KEY])
  for (const agent of detectedAgents) {
    const key = SKILLS_CLI_AGENT_KEY_BY_TUI_AGENT[agent]
    if (key) {
      keys.add(key)
    }
  }
  return [...keys].sort()
}
