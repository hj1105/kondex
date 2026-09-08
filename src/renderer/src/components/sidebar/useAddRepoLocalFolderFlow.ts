import { useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { isGitRepoKind } from '../../../../shared/repo-kind'
import type { NestedRepoScanResult } from '../../../../shared/project-group-types'
import type { Repo } from '../../../../shared/repo-types'
import type { WorktreeFetchOptions } from '@/store/slices/worktree-helpers'
import type { RepoSlice } from '@/store/repos/repo-state'
import { createNestedRepoScanId } from './add-repo-dialog-types'
import { translate } from '@/i18n/i18n'
import { worktreeRefreshOptions } from './add-repo-runtime-owner'
import type { ExecutionHostId } from '../../../../shared/execution-host'

type ShowNestedRepoReview = (args: {
  scan: NestedRepoScanResult
  selectedPath: string
  connectionId: string | null
  inProgress: boolean
  scanId: string | null
  runtimeEnvironmentId?: string | null
}) => void

type LocalPathAddResult =
  | { status: 'completed'; repo: Repo }
  | { status: 'cancelled' | 'paused' | 'skipped' }

type LocalPathAddMode = 'single' | 'batch'

export function useAddRepoLocalFolderFlow({
  isOpen,
  droppedLocalPath,
  activeRuntimeEnvironmentId,
  addRepoPath,
  closeModal,
  fetchWorktrees,
  scanNestedRepos,
  setActiveNestedScanId,
  setNestedScanInProgress,
  showNestedRepoReview,
  onGitRepoReady,
  setIsAdding,
  setAddProjectBusyLabel
}: {
  isOpen: boolean
  droppedLocalPath: string
  activeRuntimeEnvironmentId: string | null | undefined
  addRepoPath: RepoSlice['addRepoPath']
  closeModal: () => void
  fetchWorktrees: (repoId: string, options?: WorktreeFetchOptions) => Promise<unknown>
  scanNestedRepos: RepoSlice['scanNestedRepos']
  setActiveNestedScanId: (scanId: string | null, runtimeEnvironmentId?: string | null) => void
  setNestedScanInProgress: (inProgress: boolean) => void
  showNestedRepoReview: ShowNestedRepoReview
  onGitRepoReady: (repoId: string, executionHostId?: ExecutionHostId) => Promise<void>
  setIsAdding: (isAdding: boolean) => void
  setAddProjectBusyLabel: (label: string | null) => void
}): {
  handleBrowse: () => Promise<void>
  resetLocalFolderFlow: () => void
} {
  const localAddGenRef = useRef(0)
  const droppedLocalPathHandledRef = useRef<string | null>(null)

  const resetLocalFolderFlow = useCallback((): void => {
    localAddGenRef.current++
    droppedLocalPathHandledRef.current = null
  }, [])

  const clearNestedScanState = useCallback((): void => {
    setNestedScanInProgress(false)
    setActiveNestedScanId(null)
  }, [setActiveNestedScanId, setNestedScanInProgress])

  const addLocalPathForGeneration = useCallback(
    async (
      path: string,
      gen: number,
      mode: LocalPathAddMode = 'single'
    ): Promise<LocalPathAddResult> => {
      if (activeRuntimeEnvironmentId?.trim()) {
        toast.error(
          translate(
            'auto.components.sidebar.useAddRepoLocalFolderFlow.7ab10e4974',
            'Use a host path to add projects from a remote host.'
          )
        )
        closeModal()
        return { status: 'paused' }
      }
      setAddProjectBusyLabel('Scanning for repositories...')
      try {
        const scanId = createNestedRepoScanId()
        setActiveNestedScanId(scanId, activeRuntimeEnvironmentId ?? null)
        setNestedScanInProgress(true)
        const scan = await scanNestedRepos(path, undefined, {
          scanId,
          runtimeEnvironmentId: activeRuntimeEnvironmentId ?? null,
          onProgress: (progressScan) => {
            if (
              gen !== localAddGenRef.current ||
              mode === 'batch' ||
              progressScan.selectedPathKind !== 'non_git_folder' ||
              progressScan.repos.length === 0
            ) {
              return
            }
            showNestedRepoReview({
              scan: progressScan,
              selectedPath: path,
              connectionId: null,
              inProgress: true,
              scanId,
              runtimeEnvironmentId: activeRuntimeEnvironmentId
            })
          }
        })
        if (gen !== localAddGenRef.current) {
          return { status: 'cancelled' }
        }
        clearNestedScanState()
        if (scan?.selectedPathKind === 'non_git_folder' && mode === 'batch') {
          return { status: 'skipped' }
        }
        if (scan?.selectedPathKind === 'non_git_folder' && scan.repos.length > 0) {
          // Why: a single-folder decision point cannot queue competing batch review states.
          showNestedRepoReview({
            scan,
            selectedPath: path,
            connectionId: null,
            inProgress: false,
            scanId,
            runtimeEnvironmentId: activeRuntimeEnvironmentId
          })
          return { status: 'paused' }
        }
        setAddProjectBusyLabel('Opening project...')
        const repo = await addRepoPath(path, undefined, {
          runtimeEnvironmentId: activeRuntimeEnvironmentId ?? null
        })
        if (gen !== localAddGenRef.current) {
          return { status: 'cancelled' }
        }
        if (!repo) {
          return { status: 'paused' }
        }
        if (isGitRepoKind(repo)) {
          // Why: a transient non-authoritative refresh must not strand a persisted repo.
          const ownerOptions = worktreeRefreshOptions(activeRuntimeEnvironmentId ?? null)
          await fetchWorktrees(repo.id, ownerOptions)
          if (gen !== localAddGenRef.current) {
            return { status: 'cancelled' }
          }
          if (mode === 'batch') {
            return { status: 'completed', repo }
          }
          await onGitRepoReady(repo.id, ownerOptions.executionHostId)
        } else {
          // Why: folder repos skip the Git default-checkout handoff and activate
          // their synthetic root workspace in the folder add flow.
          closeModal()
        }
        return { status: 'completed', repo }
      } finally {
        if (gen === localAddGenRef.current) {
          clearNestedScanState()
        }
      }
    },
    [
      activeRuntimeEnvironmentId,
      addRepoPath,
      clearNestedScanState,
      closeModal,
      fetchWorktrees,
      onGitRepoReady,
      scanNestedRepos,
      setActiveNestedScanId,
      setAddProjectBusyLabel,
      setNestedScanInProgress,
      showNestedRepoReview
    ]
  )

  const handleAddLocalPath = useCallback(
    async (path: string, mode: LocalPathAddMode = 'single'): Promise<LocalPathAddResult> => {
      const gen = ++localAddGenRef.current
      setIsAdding(true)
      try {
        return await addLocalPathForGeneration(path, gen, mode)
      } finally {
        if (gen === localAddGenRef.current) {
          clearNestedScanState()
          setIsAdding(false)
          setAddProjectBusyLabel(null)
        }
      }
    },
    [addLocalPathForGeneration, clearNestedScanState, setAddProjectBusyLabel, setIsAdding]
  )

  const handleAddLocalPaths = useCallback(
    async (paths: string[], gen: number): Promise<void> => {
      const gitRepoIds: string[] = []
      const shouldDeferGitRepoReady = paths.length > 1
      let skippedCount = 0
      for (const path of paths) {
        const result = await addLocalPathForGeneration(
          path,
          gen,
          shouldDeferGitRepoReady ? 'batch' : 'single'
        )
        if (result.status === 'skipped') {
          skippedCount++
          continue
        }
        if (result.status !== 'completed') {
          return
        }
        if (isGitRepoKind(result.repo)) {
          gitRepoIds.push(result.repo.id)
        }
      }
      if (gen !== localAddGenRef.current) {
        return
      }
      if (skippedCount > 0) {
        toast.info(
          translate(
            'auto.components.sidebar.useAddRepoLocalFolderFlow.skippedBatchFolders',
            'Some folders were skipped'
          ),
          {
            description: translate(
              'auto.components.sidebar.useAddRepoLocalFolderFlow.skippedBatchFoldersDescription',
              'Add skipped folders individually to review or confirm them.'
            )
          }
        )
      }
      if (shouldDeferGitRepoReady && gitRepoIds.length > 0) {
        await onGitRepoReady(
          gitRepoIds[0],
          worktreeRefreshOptions(activeRuntimeEnvironmentId ?? null).executionHostId
        )
      }
    },
    [activeRuntimeEnvironmentId, addLocalPathForGeneration, onGitRepoReady]
  )

  useEffect(() => {
    if (!isOpen || !droppedLocalPath) {
      return
    }
    if (droppedLocalPathHandledRef.current === droppedLocalPath) {
      return
    }
    droppedLocalPathHandledRef.current = droppedLocalPath
    void handleAddLocalPath(droppedLocalPath)
  }, [droppedLocalPath, handleAddLocalPath, isOpen])

  const handleBrowse = useCallback(async (): Promise<void> => {
    const gen = ++localAddGenRef.current
    setIsAdding(true)
    setAddProjectBusyLabel('Choose a folder...')
    try {
      const paths = await window.api.repos.pickFolders()
      if (paths.length === 0 || gen !== localAddGenRef.current) {
        return
      }
      await handleAddLocalPaths(paths, gen)
    } finally {
      if (gen === localAddGenRef.current) {
        clearNestedScanState()
        setIsAdding(false)
        setAddProjectBusyLabel(null)
      }
    }
  }, [clearNestedScanState, handleAddLocalPaths, setAddProjectBusyLabel, setIsAdding])

  return { handleBrowse, resetLocalFolderFlow }
}
