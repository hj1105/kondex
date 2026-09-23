import { useMemo } from 'react'
import { useAppStore } from '../../store'
import type { AppState } from '../../store/types'
import { getFolderWorkspaceHostId } from '../../store/folder-workspaces/folder-workspace-catalog'
import { normalizeRuntimePathForComparison } from '../../../../shared/cross-platform-path'
import {
  getRepoExecutionHostId,
  LOCAL_EXECUTION_HOST_ID,
  toRuntimeExecutionHostId,
  type ExecutionHostId
} from '../../../../shared/execution-host'
import type { KontextRequestOwner } from './kontext-request-journal'

export type KontextWorkspaceOption = {
  id: string
  title: string
  directory: string
  kind: 'worktree' | 'folder'
}
type WorkspaceCatalog = Pick<
  AppState,
  'worktreesByRepo' | 'folderWorkspaces' | 'repos' | 'projectGroups'
>

export function kontextOwnerHostId(owner: KontextRequestOwner): ExecutionHostId {
  return owner.kind === 'environment'
    ? toRuntimeExecutionHostId(owner.environmentId)
    : LOCAL_EXECUTION_HOST_ID
}

/** Workspaces on the owner's host, keyed by the selector that host accepts; the catalogs span every host. */
export function listKontextWorkspaceOptions(
  catalog: Partial<WorkspaceCatalog>,
  hostId: ExecutionHostId
): KontextWorkspaceOption[] {
  const repos = catalog.repos ?? []
  // Why: a legacy row without hostId borrows its repo's host; repo ids repeat across hosts, so disagreement means unknown.
  const worktreeHost = (worktree: { hostId?: ExecutionHostId; repoId: string }) => {
    if (worktree.hostId) {
      return worktree.hostId
    }
    const hosts = new Set(
      repos.filter((repo) => repo.id === worktree.repoId).map(getRepoExecutionHostId)
    )
    return hosts.size > 1 ? null : ([...hosts][0] ?? LOCAL_EXECUTION_HOST_ID)
  }
  // Why: the slice is absent until the store hydrates, and a panel that throws
  // there takes the whole Kontext page down with it.
  const worktreeRows = Object.values(catalog.worktreesByRepo ?? {})
    .flat()
    .filter((worktree) => worktree !== null && worktree !== undefined)
    .filter((worktree) => worktreeHost(worktree) === hostId)
    .map((worktree) => ({
      id: worktree.id,
      title: worktree.displayName,
      directory: worktree.id.split('::').slice(1).join('::'),
      kind: 'worktree' as const
    }))
  // Why: a folder workspace is a workspace too — its kontext.yaml lives in the
  // folder — and the host resolves it through the `folder:` selector.
  const folderRows = (catalog.folderWorkspaces ?? [])
    .filter((workspace) => !workspace.isArchived)
    .filter(
      (workspace) => getFolderWorkspaceHostId(workspace, catalog.projectGroups ?? []) === hostId
    )
    .map((workspace) => ({
      id: `folder:${workspace.id}`,
      title: workspace.name,
      directory: workspace.folderPath,
      kind: 'folder' as const
    }))
  const rows = [...worktreeRows, ...folderRows]
  // Why: two workspaces can share a display name, and identical options are
  // unpickable — the directory is what tells them apart.
  const seen = new Map<string, number>()
  for (const row of rows) {
    seen.set(row.title, (seen.get(row.title) ?? 0) + 1)
  }
  return rows.map((row) => {
    if ((seen.get(row.title) ?? 0) < 2) {
      return row
    }
    const directory = row.directory.split(/[\\/]/).findLast((segment) => segment !== '')
    return { ...row, title: directory ? `${row.title} — ${directory}` : row.title }
  })
}

export function useKontextWorkspaceOptions(owner: KontextRequestOwner): KontextWorkspaceOption[] {
  const worktreesByRepo = useAppStore((s) => s.worktreesByRepo)
  const folderWorkspaces = useAppStore((s) => s.folderWorkspaces)
  const repos = useAppStore((s) => s.repos)
  const projectGroups = useAppStore((s) => s.projectGroups)
  const hostId = kontextOwnerHostId(owner)
  return useMemo(
    () =>
      listKontextWorkspaceOptions(
        { worktreesByRepo, folderWorkspaces, repos, projectGroups },
        hostId
      ),
    [worktreesByRepo, folderWorkspaces, repos, projectGroups, hostId]
  )
}

/**
 * Main resolves a folder workspace only by `folder:<id>`, so a typed path naming exactly one
 * folder is mapped to it. Worktree paths already resolve by path; anything else is sent unchanged
 * so the host decides, including its own `selector_ambiguous`.
 */
export function kontextWorkspaceSelector(
  value: string,
  options: readonly KontextWorkspaceOption[]
): string {
  const trimmed = value.trim()
  if (!trimmed) {
    return trimmed
  }
  const key = normalizeRuntimePathForComparison(trimmed)
  const matches = options.filter(
    (option) =>
      option.kind === 'folder' && normalizeRuntimePathForComparison(option.directory) === key
  )
  return matches.length === 1 ? matches[0].id : trimmed
}
