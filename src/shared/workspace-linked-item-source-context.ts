import { getWorkspaceSourceProvider } from './new-workspace/workspace-source'
import type { TaskSourceContext } from './task-source-context'
import type { WorkspaceLinkedItem } from './worktree/types'

function resolveLinkedItemProvider(
  item: Pick<WorkspaceLinkedItem, 'type' | 'number' | 'url'> & Partial<WorkspaceLinkedItem>
): WorkspaceLinkedItem['provider'] {
  if (item.provider) {
    return item.provider
  }
  // Why: TaskPage seeds can omit title; provider inference only needs type/url/identifiers.
  return getWorkspaceSourceProvider({
    type: item.type,
    number: item.number,
    url: item.url,
    title: item.title ?? '',
    ...(item.repoId ? { repoId: item.repoId } : {})
  })
}

export function isWorkspaceLinkedItemSourceContextMatch(
  item:
    | (Pick<WorkspaceLinkedItem, 'type' | 'number' | 'url'> & Partial<WorkspaceLinkedItem>)
    | null
    | undefined,
  context: TaskSourceContext | null | undefined
): boolean {
  if (!item || !context) {
    return false
  }
  // Why: TaskPage still seeds some GH/GL items without provider; use the same inference as write paths.
  const itemProvider = resolveLinkedItemProvider(item)
  if (itemProvider !== context.provider) {
    return false
  }
  return true
}
