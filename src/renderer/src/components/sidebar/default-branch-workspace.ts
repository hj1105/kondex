import type { Worktree } from '../../../../shared/worktree/types'

export function isDefaultBranchWorkspace(worktree: Worktree): boolean {
  return worktree.isMainWorktree && worktree.branch.trim() !== ''
}
