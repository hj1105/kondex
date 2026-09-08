import type {
  NeedsSetupProjectHostOption,
  ProjectHostSetupOption,
  ReadyProjectHostSetupOption
} from '@/lib/project-host-setup-options'

export const RUN_TARGET_ADD_HOST_KEY = 'add-host'

/** A row in the run-target list. Hosts commit; Add host opens a submenu. */
export type RunTargetRowModel =
  | { key: string; kind: 'ready'; option: ReadyProjectHostSetupOption }
  | { key: string; kind: 'needs-setup'; option: NeedsSetupProjectHostOption }
  | { key: typeof RUN_TARGET_ADD_HOST_KEY; kind: 'add-host' }

function matches(haystack: string, query: string): boolean {
  return haystack.toLowerCase().includes(query)
}

/**
 * Filters hosts by a typed query. "Add host" always survives, so it stays
 * reachable in every state including no-matches.
 */
export function buildRunTargetRows({
  hostOptions,
  query,
  hasAddHost
}: {
  hostOptions: readonly ProjectHostSetupOption[]
  query: string
  hasAddHost: boolean
}): { rows: RunTargetRowModel[] } {
  const trimmed = query.trim().toLowerCase()
  const hostMatches = (option: ProjectHostSetupOption): boolean =>
    trimmed === '' ||
    matches(option.label, trimmed) ||
    matches(option.detail, trimmed) ||
    (option.kind === 'ready' && matches(option.path, trimmed))

  const ready = hostOptions.filter(
    (option): option is ReadyProjectHostSetupOption =>
      option.kind === 'ready' && hostMatches(option)
  )
  const needsSetup = hostOptions.filter(
    (option): option is NeedsSetupProjectHostOption =>
      option.kind === 'needs-setup' && hostMatches(option)
  )
  const rows: RunTargetRowModel[] = [
    ...ready.map((option) => ({ key: `host:${option.id}`, kind: 'ready' as const, option })),
    ...needsSetup.map((option) => ({
      key: `needs:${option.id}`,
      kind: 'needs-setup' as const,
      option
    }))
  ]
  if (hasAddHost) {
    rows.push({ key: RUN_TARGET_ADD_HOST_KEY, kind: 'add-host' })
  }
  return { rows }
}
