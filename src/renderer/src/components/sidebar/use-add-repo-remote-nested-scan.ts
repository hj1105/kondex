import { useCallback } from 'react'
import type { NestedRepoScanResult } from '../../../../shared/project-group-types'

export function useAddRepoRemoteNestedScan({
  setActiveNestedScanId,
  showNestedRepoReview
}: {
  setActiveNestedScanId: (scanId: string | null, runtimeEnvironmentId?: string | null) => void
  showNestedRepoReview: (options: {
    scan: NestedRepoScanResult
    selectedPath: string
    connectionId: string
    inProgress: boolean
    scanId: string | null
    runtimeEnvironmentId?: string | null
  }) => void
}) {
  const showRemoteNestedRepoReview = useCallback(
    (
      scan: NestedRepoScanResult,
      selectedPath: string,
      connectionId: string,
      inProgress: boolean,
      scanId: string | null
    ) => {
      setActiveNestedScanId(inProgress ? scanId : null, null)
      showNestedRepoReview({
        scan,
        selectedPath,
        connectionId,
        inProgress,
        scanId,
        runtimeEnvironmentId: null
      })
    },
    [setActiveNestedScanId, showNestedRepoReview]
  )

  return { showRemoteNestedRepoReview }
}
