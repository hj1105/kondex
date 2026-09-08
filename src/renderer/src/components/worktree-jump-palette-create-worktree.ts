import { parseGitHubIssueOrPRLink, parseGitHubIssueOrPRNumber } from '@/lib/github-links'
import {
  getLinkedWorkItemSuggestedName,
  getLinkedWorkItemWorkspaceName,
  type LinkedWorkItemSummary
} from '@/lib/new-workspace'
import { lookupGitHubWorkItemForSource } from '@/lib/github-work-item-source-lookup'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import { queueWorkspaceActivationTerminalFocus } from '@/lib/workspace-activation-terminal-focus'
import { getRepoMapFromState } from '@/store/selectors'
import { useAppStore } from '@/store'
import { isGitRepoKind } from '../../../shared/repo-kind'
import { buildTaskSourceContextFromRepo } from '../../../shared/task-source-context'
import { isWorktreePaletteCreateActivationAllowed } from '@/lib/worktree-palette-create-action'
import type { WorktreeJumpPaletteFilter } from './use-worktree-jump-palette-filter'
import type { WorktreeJumpPaletteLocalState } from './use-worktree-jump-palette-local-state'
import type { WorktreeJumpPaletteQuickActions } from './use-worktree-jump-palette-quick-actions'
import type { WorktreeJumpPaletteSelectionLifecycle } from './use-worktree-jump-palette-selection-lifecycle'
import type { WorktreeJumpPaletteStoreState } from './use-worktree-jump-palette-store-state'
import type { WorktreeJumpPaletteTaskUrl } from './use-worktree-jump-palette-task-url'

type WorktreeJumpPaletteCreateWorktreeInput = Pick<
  WorktreeJumpPaletteStoreState,
  'allWorktrees' | 'closeModal' | 'openModal'
> &
  Pick<WorktreeJumpPaletteFilter, 'repoMap'> &
  Pick<
    WorktreeJumpPaletteLocalState,
    | 'createLookupGuard'
    | 'createWorktreeName'
    | 'liveQueryRef'
    | 'preserveCreateLookupOnCloseRef'
    | 'selectionMovedByUserRef'
    | 'skipRestoreFocusRef'
    | 'taskSourceUrl'
  > &
  Pick<WorktreeJumpPaletteQuickActions, 'prefetchCreateWorkspaceBaseForComposer'> &
  Pick<WorktreeJumpPaletteSelectionLifecycle, 'focusFallbackSurface'> &
  Pick<
    WorktreeJumpPaletteTaskUrl,
    'currentGitHubWorkItemPreview' | 'githubLookupRef' | 'taskUrlCreatePreview'
  >

export function createWorktreeJumpPaletteWorktreeHandler({
  allWorktrees,
  closeModal,
  createLookupGuard,
  createWorktreeName,
  currentGitHubWorkItemPreview,
  focusFallbackSurface,
  githubLookupRef,
  liveQueryRef,
  openModal,
  prefetchCreateWorkspaceBaseForComposer,
  preserveCreateLookupOnCloseRef,
  repoMap,
  selectionMovedByUserRef,
  skipRestoreFocusRef,
  taskSourceUrl,
  taskUrlCreatePreview
}: WorktreeJumpPaletteCreateWorktreeInput): () => void {
  return () => {
    const trimmed = createWorktreeName.trim()
    if (liveQueryRef.current.trim() !== trimmed) {
      return
    }
    if (
      !isWorktreePaletteCreateActivationAllowed({
        hasTaskUrlIntent: taskSourceUrl !== null,
        hasCreateName: trimmed.length > 0,
        selectionMovedByUser: selectionMovedByUserRef.current
      })
    ) {
      return
    }
    const ghLink = parseGitHubIssueOrPRLink(trimmed)
    const ghNumber = parseGitHubIssueOrPRNumber(trimmed)
    const openComposer = (data: Record<string, unknown>): void => {
      skipRestoreFocusRef.current = true
      prefetchCreateWorkspaceBaseForComposer(
        typeof data.initialRepoId === 'string' ? data.initialRepoId : undefined
      )
      closeModal()
      queueMicrotask(() =>
        openModal('new-workspace-composer', { ...data, telemetrySource: 'command_palette' })
      )
    }

    if (ghLink) {
      const lookup = githubLookupRef.current
      const resolve = async (): Promise<void> => {
        const preview = currentGitHubWorkItemPreview?.loading
          ? await lookup?.promise
          : (currentGitHubWorkItemPreview ?? (await lookup?.promise))
        if (
          !preview ||
          lookup?.query !== trimmed ||
          githubLookupRef.current !== lookup ||
          liveQueryRef.current.trim() !== trimmed ||
          useAppStore.getState().activeModal !== 'worktree-palette'
        ) {
          return
        }
        const item = preview.item
        if (item) {
          const linkedWorkItem: LinkedWorkItemSummary = {
            provider: 'github',
            type: item.type,
            number: item.number,
            title: item.title,
            url: item.url,
            ...(item.repoId ? { repoId: item.repoId } : {})
          }
          openComposer({
            prefilledName:
              getLinkedWorkItemWorkspaceName(linkedWorkItem)?.seedName ??
              getLinkedWorkItemSuggestedName({ title: item.title }),
            linkedWorkItem,
            initialGitHubWorkItem: item,
            ...(preview.initialRepoId ? { initialRepoId: preview.initialRepoId } : {}),
            ...(preview.sourceContext ? { taskSourceContext: preview.sourceContext } : {})
          })
        } else {
          openComposer({
            prefilledName: trimmed,
            ...(preview.initialRepoId ? { initialRepoId: preview.initialRepoId } : {})
          })
        }
      }
      void resolve()
      return
    }

    if (taskUrlCreatePreview) {
      const state = useAppStore.getState()
      const eligibleRepos = state.repos.filter((repo) => isGitRepoKind(repo))
      const repo =
        (state.activeRepoId &&
          eligibleRepos.find((candidate) => candidate.id === state.activeRepoId)) ||
        eligibleRepos[0]
      openComposer(
        repo ? { prefilledName: trimmed, initialRepoId: repo.id } : { prefilledName: trimmed }
      )
      return
    }

    if (ghNumber !== null) {
      const state = useAppStore.getState()
      const matches = allWorktrees.filter(
        (worktree) =>
          !worktree.isArchived &&
          (worktree.linkedIssue === ghNumber || worktree.linkedPR === ghNumber)
      )
      const activeMatch =
        matches.find((worktree) => worktree.repoId === state.activeRepoId) ?? matches[0]
      if (activeMatch) {
        skipRestoreFocusRef.current = true
        closeModal()
        const activation = activateAndRevealWorktree(
          activeMatch.id,
          activeMatch.hostId ? { executionHostId: activeMatch.hostId } : {}
        )
        if (!queueWorkspaceActivationTerminalFocus(activeMatch.id, activation)) {
          focusFallbackSurface()
        }
        return
      }
      const repo =
        (state.activeRepoId ? (repoMap.get(state.activeRepoId) ?? null) : null) ||
        [...getRepoMapFromState(state).values()].find((candidate) => isGitRepoKind(candidate))
      if (!repo || !isGitRepoKind(repo)) {
        openComposer({ prefilledName: trimmed })
        return
      }
      prefetchCreateWorkspaceBaseForComposer(repo.id)
      const sourceContext = buildTaskSourceContextFromRepo({
        provider: 'github',
        projectId: repo.id,
        repo
      })
      const token = createLookupGuard.start()
      preserveCreateLookupOnCloseRef.current = true
      skipRestoreFocusRef.current = true
      closeModal()
      void lookupGitHubWorkItemForSource({
        repoPath: repo.path,
        repoId: repo.id,
        sourceContext,
        number: ghNumber
      })
        .then((item) => {
          if (!createLookupGuard.isCurrent(token)) {
            return
          }
          const linkedWorkItem = item
            ? { type: item.type, number: item.number, title: item.title, url: item.url }
            : null
          queueMicrotask(() =>
            openModal('new-workspace-composer', {
              initialRepoId: repo.id,
              ...(linkedWorkItem
                ? {
                    linkedWorkItem,
                    prefilledName:
                      getLinkedWorkItemWorkspaceName(linkedWorkItem)?.seedName ??
                      getLinkedWorkItemSuggestedName({ title: linkedWorkItem.title })
                  }
                : { prefilledName: trimmed }),
              telemetrySource: 'command_palette'
            })
          )
        })
        .catch(() => {
          if (createLookupGuard.isCurrent(token)) {
            queueMicrotask(() =>
              openModal('new-workspace-composer', {
                initialRepoId: repo.id,
                prefilledName: trimmed,
                telemetrySource: 'command_palette'
              })
            )
          }
        })
      return
    }
    openComposer(trimmed ? { prefilledName: trimmed } : {})
  }
}
