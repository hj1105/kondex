import type { DirectSshAuthority } from '../../../shared/ssh-types'
import type { DirectSshGitRepoRef } from '../lib/direct-ssh-target-scope-types'
import type {
  DirectSshWorktreeRefreshScheduler,
  DirectSshWorktreeRefreshTerminalStatus
} from './direct-ssh-worktree-refresh-scheduler'

export type DirectSshPreparationReason =
  | 'reconnect'
  | 'initial-hydration'
  | 'workspace-snapshot'
  | 'wake-refresh'

export type DirectSshAuthorityRequirement = 'required' | 'allow-metadata-fallback'

export type DirectSshPreparationInput = DirectSshAuthority & {
  catalogRevision: number
  repoRefs: readonly DirectSshGitRepoRef[]
  authorityRequirement: DirectSshAuthorityRequirement
  snapshotRevision?: number
  reason: DirectSshPreparationReason
}

export type DirectSshPreparationToken = {
  authority: DirectSshAuthority
  catalogRevision: number
  repoFingerprint: string
  authorityRequirement: DirectSshAuthorityRequirement
  snapshotRevision: number | null
  outcome: 'complete' | 'degraded'
}

export type DirectSshSnapshotApplyToken = DirectSshPreparationToken & {
  snapshotRevision: number
}

export type DirectSshLineageOutcome = 'complete' | 'degraded' | 'canceled' | 'stale'

export type DirectSshRepoOutcomeCounts = Record<DirectSshWorktreeRefreshTerminalStatus, number>

export type DirectSshPreparationOutcome = {
  status: 'complete' | 'degraded' | 'canceled' | 'stale' | 'stopped'
  token: DirectSshPreparationToken | null
  repoOutcomes: DirectSshRepoOutcomeCounts
  lineageOutcome: DirectSshLineageOutcome | 'not-started'
  metrics?: DirectSshPreparationMetrics
}

export type DirectSshPreparationMetrics = {
  queueWaitDurationsMs: readonly number[]
  providerExecutionDurationsMs: readonly number[]
  timeoutRetryCount: number
  locallySettledWaiterCount: number
  cancelDebtCount: number
  replacementAdmissionDelayedCount: number
  schedulerOverlappingJoinCount: number
  peakLocallyUnsettled: number
  estimatedLateWorkAllowanceCount: number
  lineageDurationMs: number
}

export type DirectSshReconnectOutcome = Omit<DirectSshPreparationOutcome, 'status'> & {
  status: DirectSshPreparationOutcome['status'] | 'stabilizing'
  staleBindingsCleared: number
  retriedTerminals: number
  correctedTerminals: number
  stabilizing: boolean
}

export type DirectSshCorrectionReason =
  | 'preparation-complete'
  | 'wake-refresh'
  | 'workspace-hydrated'
  | 'snapshot-applied'

export type DirectSshReconnectTimer = unknown

export type DirectSshReconnectCoordinatorDeps = {
  scheduler: DirectSshWorktreeRefreshScheduler
  isCurrentConnectedAuthority: (authority: DirectSshAuthority) => boolean
  capturePreparationInput: (
    authority: DirectSshAuthority,
    reason: DirectSshPreparationReason
  ) => Promise<DirectSshPreparationInput | null>
  readHostScopedLineage: (input: DirectSshPreparationInput) => Promise<DirectSshLineageOutcome>
  invalidateStaleTerminalBindings: (authority: DirectSshAuthority) => number
  retryTargetPanes: (authority: DirectSshAuthority) => number
  finalizeHydratedTerminalPanes: (authority: DirectSshAuthority) => number
  correctUnboundTerminalPanes: (
    authority: DirectSshAuthority,
    reason: DirectSshCorrectionReason
  ) => number
  syncRemoteWorkspaceAfterConnect: (token: DirectSshPreparationToken) => void | Promise<void>
  now?: () => number
  setTimer?: (callback: () => void, delayMs: number) => DirectSshReconnectTimer
  clearTimer?: (timer: DirectSshReconnectTimer) => void
  stabilizationMs?: number
}

export type DirectSshReconnectCoordinator = {
  requestReconnect: (authority: DirectSshAuthority) => Promise<DirectSshReconnectOutcome>
  prepareOnly: (input: DirectSshPreparationInput) => Promise<DirectSshPreparationOutcome>
  finalizeHydratedTerminals: (authority: DirectSshAuthority) => number
  correctUnboundTerminals: (
    authority: DirectSshAuthority,
    reason: DirectSshCorrectionReason
  ) => number
  replaceAuthority: (authority: DirectSshAuthority) => void
  invalidate: (targetId: string) => void
  stop: () => void
}
