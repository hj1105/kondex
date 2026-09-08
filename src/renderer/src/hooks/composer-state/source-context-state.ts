import type { ComposerModel } from './composer-model'

type ComposerSourceContextStateInput = Pick<
  ComposerModel,
  | 'decisions'
  | 'initialLinkedWorkItem'
  | 'initialName'
  | 'initialPrompt'
  | 'initialTaskSourceContext'
  | 'newWorkspaceDraft'
  | 'persistDraft'
  | 'onRepoIdOverrideChange'
  | 'projects'
  | 'selectedRepo'
  | 'selectedRepoIsGit'
  | 'setInternalRepoId'
  | 'selectedWorkspaceTarget'
>

import { useCallback, useMemo, useState } from 'react'
import { getLinkedWorkItemProvider, type LinkedWorkItemSummary } from '@/lib/new-workspace'
import {
  type TaskSourceContext,
  buildTaskSourceContextFromRepo
} from '../../../../shared/task-source-context'
import {
  normalizeGitHubLinkedWorkItem,
  getGitHubLinkedWorkItemIdentity
} from './source-selection-decisions'

export function useComposerSourceContextState(input: ComposerSourceContextStateInput) {
  const {
    decisions,
    initialLinkedWorkItem,
    initialName,
    initialPrompt,
    initialTaskSourceContext,
    newWorkspaceDraft,
    persistDraft,
    onRepoIdOverrideChange,
    projects,
    selectedRepo,
    selectedRepoIsGit,
    setInternalRepoId,
    selectedWorkspaceTarget
  } = input
  const { getMatchingLinkedTaskSourceContext } = decisions
  const setRepoId = useCallback(
    (value: string) => {
      if (onRepoIdOverrideChange) {
        onRepoIdOverrideChange(value)
      } else {
        setInternalRepoId(value)
      }
    },
    [onRepoIdOverrideChange, setInternalRepoId]
  )

  const [name, setName] = useState<string>(
    persistDraft ? (newWorkspaceDraft?.name ?? initialName) : initialName
  )

  const [agentPrompt, setAgentPrompt] = useState<string>(
    persistDraft ? (newWorkspaceDraft?.prompt ?? initialPrompt) : initialPrompt
  )

  const [note, setNote] = useState<string>(persistDraft ? (newWorkspaceDraft?.note ?? '') : '')

  const [attachmentPaths, setAttachmentPaths] = useState<string[]>(
    persistDraft ? (newWorkspaceDraft?.attachments ?? []) : []
  )

  const normalizedInitialLinkedWorkItem = normalizeGitHubLinkedWorkItem(initialLinkedWorkItem)

  const normalizedDraftLinkedWorkItem = persistDraft
    ? normalizeGitHubLinkedWorkItem(newWorkspaceDraft?.linkedWorkItem)
    : null

  const draftLinkedTaskSourceContext = persistDraft
    ? getMatchingLinkedTaskSourceContext(
        normalizedDraftLinkedWorkItem,
        newWorkspaceDraft?.linkedTaskSourceContext ?? newWorkspaceDraft?.taskSourceContext
      )
    : null

  const initialLinkedTaskSourceContext = getMatchingLinkedTaskSourceContext(
    normalizedInitialLinkedWorkItem,
    initialTaskSourceContext
  )

  const initialLinkedWorkItemSeed = normalizedInitialLinkedWorkItem

  const draftLinkedWorkItemSeed = normalizedDraftLinkedWorkItem

  const linkedWorkItemSeed = persistDraft
    ? (draftLinkedWorkItemSeed ?? initialLinkedWorkItemSeed)
    : initialLinkedWorkItemSeed

  const linkedWorkItemSeedIdentity = getGitHubLinkedWorkItemIdentity(linkedWorkItemSeed)

  const [linkedWorkItem, setLinkedWorkItem] = useState<LinkedWorkItemSummary | null>(
    () => linkedWorkItemSeed
  )

  const [linkedTaskSourceContext, setLinkedTaskSourceContext] = useState<TaskSourceContext | null>(
    () => draftLinkedTaskSourceContext ?? initialLinkedTaskSourceContext
  )

  const derivedGitHubTaskSourceContext = useMemo(() => {
    if (
      !linkedWorkItem ||
      getLinkedWorkItemProvider(linkedWorkItem) !== 'github' ||
      !selectedRepo ||
      selectedWorkspaceTarget.status !== 'ready'
    ) {
      return null
    }
    const selectedProject = projects.find(
      (project) => project.id === selectedWorkspaceTarget.target.projectId
    )
    if (selectedProject?.providerIdentity?.provider !== 'github') {
      return null
    }
    return buildTaskSourceContextFromRepo({
      provider: 'github',
      projectId: selectedWorkspaceTarget.target.projectId,
      repo: selectedRepo,
      projectHostSetupId: selectedWorkspaceTarget.target.projectHostSetupId,
      providerIdentity: selectedProject.providerIdentity
    })
  }, [linkedWorkItem, projects, selectedRepo, selectedWorkspaceTarget])

  const taskSourceContext = linkedTaskSourceContext ?? derivedGitHubTaskSourceContext

  const selectedRepoGitHubSourceContext = useMemo(() => {
    if (!selectedRepo || !selectedRepoIsGit) {
      return null
    }
    if (taskSourceContext?.provider === 'github') {
      return taskSourceContext
    }
    if (selectedWorkspaceTarget.status === 'ready') {
      const selectedProject = projects.find(
        (project) => project.id === selectedWorkspaceTarget.target.projectId
      )
      return buildTaskSourceContextFromRepo({
        provider: 'github',
        projectId: selectedWorkspaceTarget.target.projectId,
        repo: selectedRepo,
        projectHostSetupId: selectedWorkspaceTarget.target.projectHostSetupId,
        providerIdentity:
          selectedProject?.providerIdentity?.provider === 'github'
            ? selectedProject.providerIdentity
            : null
      })
    }
    return buildTaskSourceContextFromRepo({
      provider: 'github',
      projectId: selectedRepo.id,
      repo: selectedRepo
    })
  }, [projects, selectedRepo, selectedRepoIsGit, selectedWorkspaceTarget, taskSourceContext])

  return {
    setRepoId,
    name,
    setName,
    agentPrompt,
    setAgentPrompt,
    note,
    setNote,
    attachmentPaths,
    setAttachmentPaths,
    normalizedInitialLinkedWorkItem,
    normalizedDraftLinkedWorkItem,
    draftLinkedTaskSourceContext,
    initialLinkedTaskSourceContext,
    initialLinkedWorkItemSeed,
    draftLinkedWorkItemSeed,
    linkedWorkItemSeed,
    linkedWorkItemSeedIdentity,
    linkedWorkItem,
    setLinkedWorkItem,
    linkedTaskSourceContext,
    setLinkedTaskSourceContext,
    derivedGitHubTaskSourceContext,
    taskSourceContext,
    selectedRepoGitHubSourceContext
  }
}
