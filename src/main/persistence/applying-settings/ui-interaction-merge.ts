import type { WorkspaceKey } from '../../../shared/folder-workspace-types'
import type { PersistedState } from '../../../shared/persisted-state-types'
import type { WorkspaceLineage } from '../../../shared/worktree/lineage-types'
import { normalizeContextualTourIds } from '../../../shared/contextual-tours'
import { isWorkspaceKey } from '../../../shared/workspace-scope'

export function mergeContextualTourSeenIds(
  current: PersistedState['ui']['contextualToursSeenIds'],
  incoming: PersistedState['ui']['contextualToursSeenIds']
): PersistedState['ui']['contextualToursSeenIds'] {
  const merged = new Set(normalizeContextualTourIds(current))
  for (const id of normalizeContextualTourIds(incoming)) {
    merged.add(id)
  }
  return [...merged]
}

export function stripRetiredUIFields(
  value: Partial<PersistedState['ui']> | undefined
): Partial<PersistedState['ui']> {
  if (!value || typeof value !== 'object') {
    return {}
  }
  const {
    featureInteractions: _retiredFeatureInteractions,
    featureInteractionTelemetryBuckets: _retiredInteractionBuckets,
    dismissedUpdateVersion: _dismissedUpdateVersion,
    lastUpdateCheckAt: _lastUpdateCheckAt,
    releaseChannelOverride: _releaseChannelOverride,
    pendingUpdateNudgeId: _pendingUpdateNudgeId,
    dismissedUpdateNudgeId: _dismissedUpdateNudgeId,
    updateReassuranceSeen: _updateReassuranceSeen,
    petVisible: _retiredPetVisible,
    petId: _retiredPetId,
    customPets: _retiredCustomPets,
    petSize: _retiredPetSize,
    sidekickVisible: _retiredSidekickVisible,
    sidekickId: _retiredSidekickId,
    customSidekicks: _retiredCustomSidekicks,
    sidekickSize: _retiredSidekickSize,
    taskResumeState: _retiredTaskResumeState,
    syncTaskStatusFromWorkspaceBoard: _retiredTaskStatusSync,
    _kimiStatusBarDefaultAdded: _retiredKimiStatusBar,
    _minimaxStatusBarDefaultAdded: _retiredMinimaxStatusBar,
    _antigravityStatusBarDefaultAdded: _retiredAntigravityStatusBar,
    _grokStatusBarDefaultAdded: _retiredGrokStatusBar,
    _expandedWorktreeCardPropertiesDefaulted: _retiredExpandedTaskCardMigration,
    _jiraIssueWorktreeCardPropertyDefaulted: _retiredJiraCardMigration,
    ...ui
  } = value as Partial<PersistedState['ui']> & {
    featureInteractions?: unknown
    featureInteractionTelemetryBuckets?: unknown
    dismissedUpdateVersion?: unknown
    lastUpdateCheckAt?: unknown
    releaseChannelOverride?: unknown
    pendingUpdateNudgeId?: unknown
    dismissedUpdateNudgeId?: unknown
    updateReassuranceSeen?: unknown
    petVisible?: unknown
    petId?: unknown
    customPets?: unknown
    petSize?: unknown
    sidekickVisible?: unknown
    sidekickId?: unknown
    customSidekicks?: unknown
    sidekickSize?: unknown
    taskResumeState?: unknown
    syncTaskStatusFromWorkspaceBoard?: unknown
    _kimiStatusBarDefaultAdded?: unknown
    _minimaxStatusBarDefaultAdded?: unknown
    _antigravityStatusBarDefaultAdded?: unknown
    _grokStatusBarDefaultAdded?: unknown
    _expandedWorktreeCardPropertiesDefaulted?: unknown
    _jiraIssueWorktreeCardPropertyDefaulted?: unknown
  }
  void _retiredFeatureInteractions
  void _retiredInteractionBuckets
  void _dismissedUpdateVersion
  void _lastUpdateCheckAt
  void _releaseChannelOverride
  void _pendingUpdateNudgeId
  void _dismissedUpdateNudgeId
  void _updateReassuranceSeen
  void _retiredPetVisible
  void _retiredPetId
  void _retiredCustomPets
  void _retiredPetSize
  void _retiredSidekickVisible
  void _retiredSidekickId
  void _retiredCustomSidekicks
  void _retiredSidekickSize
  void _retiredTaskResumeState
  void _retiredTaskStatusSync
  void _retiredKimiStatusBar
  void _retiredMinimaxStatusBar
  void _retiredAntigravityStatusBar
  void _retiredGrokStatusBar
  void _retiredExpandedTaskCardMigration
  void _retiredJiraCardMigration
  return ui
}

export function normalizeWorkspaceLineageByChildKey(
  value: unknown
): Record<WorkspaceKey, WorkspaceLineage> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }
  const normalized: Record<WorkspaceKey, WorkspaceLineage> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (!isWorkspaceKey(key) || !entry || typeof entry !== 'object') {
      continue
    }
    const lineage = entry as Partial<WorkspaceLineage>
    const childWorkspaceKey =
      typeof lineage.childWorkspaceKey === 'string' && isWorkspaceKey(lineage.childWorkspaceKey)
        ? lineage.childWorkspaceKey
        : key
    const parentWorkspaceKey = lineage.parentWorkspaceKey
    if (
      !isWorkspaceKey(childWorkspaceKey) ||
      typeof parentWorkspaceKey !== 'string' ||
      !isWorkspaceKey(parentWorkspaceKey) ||
      childWorkspaceKey !== key ||
      childWorkspaceKey === parentWorkspaceKey
    ) {
      continue
    }
    normalized[childWorkspaceKey] = {
      childWorkspaceKey,
      childInstanceId: lineage.childInstanceId ?? null,
      parentWorkspaceKey,
      parentInstanceId: lineage.parentInstanceId ?? null,
      origin: lineage.origin ?? 'cli',
      capture: lineage.capture ?? { source: 'manual-action', confidence: 'inferred' },
      ...(lineage.taskId ? { taskId: lineage.taskId } : {}),
      ...(lineage.orchestrationRunId ? { orchestrationRunId: lineage.orchestrationRunId } : {}),
      ...(lineage.coordinatorHandle ? { coordinatorHandle: lineage.coordinatorHandle } : {}),
      ...(lineage.createdByTerminalHandle
        ? { createdByTerminalHandle: lineage.createdByTerminalHandle }
        : {}),
      createdAt: Number.isFinite(lineage.createdAt) ? Number(lineage.createdAt) : Date.now()
    }
  }
  return normalized
}
