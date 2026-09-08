import { useCallback } from 'react'
import { finishProjectAddWithDefaultCheckout } from './project-added-default-checkout'
import type { ExecutionHostId } from '../../../../shared/execution-host'

type CompleteGitRepoAddOptions = {
  closeModal: () => void
  setHideDefaultBranchWorkspace: (hide: boolean) => void
  /** Why: the nested Add Project flow (hosted inside the workspace composer)
   *  keeps the composer open and selects the new project instead of running
   *  the default-checkout navigation handoff. */
  finishProjectAdd?: (repoId: string, executionHostId?: ExecutionHostId) => Promise<void>
}

export function useCompleteGitRepoAdd({
  closeModal,
  setHideDefaultBranchWorkspace,
  finishProjectAdd
}: CompleteGitRepoAddOptions): (
  repoId: string,
  executionHostId?: ExecutionHostId
) => Promise<void> {
  return useCallback(
    async (repoId: string, executionHostId?: ExecutionHostId): Promise<void> => {
      if (finishProjectAdd) {
        await finishProjectAdd(repoId, executionHostId)
        return
      }
      await finishProjectAddWithDefaultCheckout({
        repoId,
        executionHostId,
        closeModal,
        setHideDefaultBranchWorkspace
      })
    },
    [closeModal, finishProjectAdd, setHideDefaultBranchWorkspace]
  )
}
