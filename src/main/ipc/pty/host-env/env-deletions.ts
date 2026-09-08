import { AGENT_HOOK_RUNTIME_ENV_KEYS, CLAUDE_CHILD_SESSION_STAMP_ENV_KEYS } from './spawn-env-keys'

// Why: variadic because a nested call per source made intermediate `string[] | undefined` collide with the parameter type.
export function mergePtyEnvDeletions(
  existingKeys: string[] | undefined,
  ...additionalKeyGroups: readonly (readonly string[])[]
): string[] | undefined {
  if (!existingKeys && additionalKeyGroups.every((keys) => keys.length === 0)) {
    return undefined
  }
  return Array.from(new Set([...(existingKeys ?? []), ...additionalKeyGroups.flat()]))
}

export function removeCodexHomeDeletionRequests(keys: string[] | undefined): string[] | undefined {
  // Why: resume provenance is launch-authoritative; late deletions must not fall back to the current account.
  const filtered = keys?.filter((key) => key !== 'CODEX_HOME' && key !== 'ORCA_CODEX_HOME')
  return filtered?.length ? filtered : undefined
}

export function getInheritedAgentHookEnvKeysToDelete(
  spawnEnv: Record<string, string> | undefined
): string[] {
  const env = spawnEnv ?? {}
  // Why: providers merge process.env after cleanup; delete stale hook keys without dropping fresh coordinates buildPtyHostEnv set.
  return AGENT_HOOK_RUNTIME_ENV_KEYS.filter((key) => env[key] === undefined)
}

export function getInheritedClaudeSessionStampEnvKeysToDelete(
  spawnEnv: Record<string, string> | undefined
): string[] {
  const env = spawnEnv ?? {}
  // Why: strip only values inherited from the pty host; a caller that explicitly
  // provides a stamp (deliberately spawning a nested Claude child) keeps it.
  return CLAUDE_CHILD_SESSION_STAMP_ENV_KEYS.filter((key) => env[key] === undefined)
}
