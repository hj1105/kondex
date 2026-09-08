import { toast } from 'sonner'
import { useAppStore } from '@/store'
import type { NestedRepoScanResult } from '../../../../shared/project-group-types'
import type { CapturedRuntimeOwner } from './add-repo-runtime-owner'

export async function completeNestedFolderOpen(args: {
  scan: NestedRepoScanResult
  generation: number
  currentGeneration: () => number
  connectionId: string | null
  owner: CapturedRuntimeOwner
  /** User-entered project name; falls back to the host's basename naming when absent. */
  displayName?: string
  closeModal: () => void
  setIsAdding: (value: boolean) => void
}): Promise<void> {
  args.setIsAdding(true)
  try {
    const state = useAppStore.getState()
    if (args.connectionId) {
      args.closeModal()
      state.openModal('confirm-non-git-folder', {
        folderPath: args.scan.selectedPath,
        connectionId: args.connectionId,
        runtimeEnvironmentId: args.owner,
        ...(args.displayName ? { displayName: args.displayName } : {})
      })
      return
    }
    const repo = await state.addNonGitFolder(args.scan.selectedPath, {
      runtimeEnvironmentId: args.owner ?? null,
      ...(args.displayName ? { displayName: args.displayName } : {})
    })
    if (args.generation !== args.currentGeneration()) {
      return
    }
    if (repo) {
      args.closeModal()
    }
  } catch (err) {
    if (args.generation === args.currentGeneration()) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  } finally {
    if (args.generation === args.currentGeneration()) {
      args.setIsAdding(false)
    }
  }
}
