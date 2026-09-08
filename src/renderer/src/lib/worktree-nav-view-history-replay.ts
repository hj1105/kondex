import { useAppStore } from '@/store'
import type { WorktreeNavHistoryViewEntry } from '@/store/slices/worktree-nav-history'

// Why: history replay changes only the visible page; it must not append another history entry.
export function applyWorktreeNavViewEntry(entry: WorktreeNavHistoryViewEntry): void {
  useAppStore.getState().setActiveView(entry)
}
