import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '@/store'
import {
  getComposerEligibleRepos,
  resolveComposerActiveRepoId
} from '@/lib/new-workspace-composer-repo'
import { resolveWorkspaceCreationTarget } from '@/lib/project-host-workspace-target'
import { lookupCmdJGitHubUrlWorkItem } from '@/lib/cmd-j-github-url-lookup'
import {
  withResolvedCmdJGitHubPreview,
  type CmdJTaskSourceUrl,
  getCmdJTaskUrlCreatePreview
} from '@/lib/worktree-palette-task-url-match'
import type { GitHubWorkItem } from '../../../shared/github/work-item-types'
import type { TaskSourceContext } from '../../../shared/task-source-context'
import { buildTaskSourceContextFromRepo } from '../../../shared/task-source-context'
import type { WorktreePaletteRequestGuard } from '@/lib/worktree-palette-create-action'

export type CmdJGitHubWorkItemPreview = {
  query: string
  item: GitHubWorkItem | null
  loading: boolean
  initialRepoId: string | null
  sourceContext: TaskSourceContext | null
}

function getComposerDefaultWorkspaceTarget(state: ReturnType<typeof useAppStore.getState>) {
  const eligibleRepos = getComposerEligibleRepos(state.repos)
  const activeRepoId = resolveComposerActiveRepoId(state.repos, eligibleRepos, state.activeRepoId)
  const resolution = resolveWorkspaceCreationTarget({
    eligibleRepos,
    projects: state.projects,
    projectHostSetups: state.projectHostSetups,
    activeRepoId,
    focusedHostScope: state.workspaceHostScope
  })
  return resolution.status === 'ready' ? resolution.target : null
}

export function useWorktreeJumpPaletteTaskUrl({
  visible,
  createWorktreeName,
  taskSourceUrl,
  createLookupGuard
}: {
  visible: boolean
  createWorktreeName: string
  taskSourceUrl: CmdJTaskSourceUrl | null
  createLookupGuard: WorktreePaletteRequestGuard
}) {
  const githubUrlLink = taskSourceUrl?.provider === 'github' ? taskSourceUrl.link : null
  const parsedTaskUrlCreatePreview = useMemo(
    () => (taskSourceUrl ? getCmdJTaskUrlCreatePreview(taskSourceUrl) : null),
    [taskSourceUrl]
  )
  const [githubWorkItemPreview, setGithubWorkItemPreview] =
    useState<CmdJGitHubWorkItemPreview | null>(null)
  const githubLookupRef = useRef<{
    query: string
    promise: Promise<CmdJGitHubWorkItemPreview>
  } | null>(null)
  const githubGenerationRef = useRef(0)

  useLayoutEffect(() => {
    const generation = ++githubGenerationRef.current
    githubLookupRef.current = null
    if (!visible || !githubUrlLink) {
      setGithubWorkItemPreview(null)
      return
    }
    const state = useAppStore.getState()
    const target = getComposerDefaultWorkspaceTarget(state)
    const sourceContext = target
      ? buildTaskSourceContextFromRepo({
          provider: 'github',
          projectId: target.projectId,
          repo: target.repo,
          projectHostSetupId: target.projectHostSetupId
        })
      : null
    const pending: CmdJGitHubWorkItemPreview = {
      query: createWorktreeName,
      item: null,
      loading: true,
      initialRepoId: target?.repoId ?? null,
      sourceContext
    }
    setGithubWorkItemPreview(pending)
    const promise = lookupCmdJGitHubUrlWorkItem({
      link: githubUrlLink,
      repo: target?.repo ?? null,
      sourceContext
    })
      .catch(() => null)
      .then((item): CmdJGitHubWorkItemPreview => ({ ...pending, item, loading: false }))
    githubLookupRef.current = { query: createWorktreeName, promise }
    void promise.then((preview) => {
      if (githubGenerationRef.current === generation) {
        setGithubWorkItemPreview(preview)
      }
    })
    return () => {
      if (githubGenerationRef.current === generation) {
        githubGenerationRef.current += 1
      }
    }
  }, [createWorktreeName, githubUrlLink, visible])

  const currentGitHubWorkItemPreview =
    githubWorkItemPreview?.query === createWorktreeName ? githubWorkItemPreview : null
  const taskUrlCreatePreview = useMemo(() => {
    if (!parsedTaskUrlCreatePreview) {
      return null
    }
    return withResolvedCmdJGitHubPreview(
      parsedTaskUrlCreatePreview,
      currentGitHubWorkItemPreview?.item?.title ?? null,
      currentGitHubWorkItemPreview?.loading === true
    )
  }, [currentGitHubWorkItemPreview, parsedTaskUrlCreatePreview])
  return {
    githubUrlLink,
    taskUrlCreatePreview,
    currentGitHubWorkItemPreview,
    githubLookupRef,
    createLookupGuard
  }
}

export type WorktreeJumpPaletteTaskUrl = ReturnType<typeof useWorktreeJumpPaletteTaskUrl>
