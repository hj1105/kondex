import type { Dispatch, SetStateAction } from 'react'
import type { ProjectGroupImportResult } from '../../../../shared/project-group-types'
import type { WorktreeFetchOptions } from '@/store/slices/worktree-helpers'
import { useAddRepoNestedImportFlow } from './useAddRepoNestedImportFlow'
import { useAddRepoNestedReviewState } from './useAddRepoNestedReviewState'
import { useAddRepoRemoteNestedScan } from './use-add-repo-remote-nested-scan'
import type { AddRepoDialogStep } from './add-repo-dialog-types'
import type { ExecutionHostId } from '../../../../shared/execution-host'

export function useAddRepoNestedReviewController({
  cancelNestedRepoScan,
  closeModal,
  fetchWorktrees,
  importNestedRepos,
  onGitRepoReady,
  setIsAdding,
  setStep
}: {
  cancelNestedRepoScan: (
    scanId: string,
    options?: { runtimeEnvironmentId?: string | null }
  ) => Promise<unknown>
  closeModal: () => void
  fetchWorktrees: (repoId: string, options?: WorktreeFetchOptions) => Promise<unknown>
  importNestedRepos: (args: {
    parentPath: string
    groupName: string
    projectPaths: string[]
    connectionId?: string
    scanId?: string
    runtimeEnvironmentId?: string | null
    mode: 'group' | 'separate'
  }) => Promise<ProjectGroupImportResult | null>
  onGitRepoReady: (repoId: string, executionHostId?: ExecutionHostId) => Promise<void>
  setIsAdding: (isAdding: boolean) => void
  setStep: Dispatch<SetStateAction<AddRepoDialogStep>>
}): ReturnType<typeof useAddRepoNestedReviewState> &
  Pick<
    ReturnType<typeof useAddRepoNestedImportFlow>,
    'handleImportNestedRepos' | 'handleOpenNestedRootFolder' | 'resetNestedImportFlow'
  > &
  ReturnType<typeof useAddRepoRemoteNestedScan> {
  const review = useAddRepoNestedReviewState({
    cancelNestedRepoScan,
    setStep
  })
  const remote = useAddRepoRemoteNestedScan({
    setActiveNestedScanId: review.setActiveNestedScanId,
    showNestedRepoReview: review.showNestedRepoReview
  })
  const imports = useAddRepoNestedImportFlow({
    closeModal,
    fetchWorktrees,
    importNestedRepos,
    onGitRepoReady,
    setIsAdding,
    nestedScan: review.nestedScan,
    nestedSelectedPaths: review.nestedSelectedPaths,
    nestedConnectionId: review.nestedConnectionId,
    nestedGroupName: review.nestedGroupName,
    nestedImportScanId: review.nestedImportScanId,
    nestedRuntimeEnvironmentId: review.nestedRuntimeEnvironmentId
  })
  return { ...review, ...remote, ...imports }
}
