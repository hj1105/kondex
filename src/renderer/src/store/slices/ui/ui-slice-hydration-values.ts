import type { PersistedUIState } from '../../../../../shared/persisted-ui-state-types'
import type { UISlice } from './ui-slice-contract'
import {
  sanitizeAcknowledgedAgentsByPaneKey,
  sanitizeActivityClearedAtByPaneKey,
  sanitizePaneKeyTimestampRecord
} from './ui-slice-hydration-sanitizers'

/** Stale acks/marks are inert (paneKey reuse beats them via stateStartedAt); the sanitizers only bound growth past HYDRATE_MAX_AGE_MS. */
export function hydrateAgentReadState(
  ui: PersistedUIState
): Pick<
  UISlice,
  'acknowledgedAgentsByPaneKey' | 'activityClearedAtByPaneKey' | 'manuallyUnreadTurnsByPaneKey'
> {
  return {
    acknowledgedAgentsByPaneKey: sanitizeAcknowledgedAgentsByPaneKey(
      ui.acknowledgedAgentsByPaneKey
    ),
    activityClearedAtByPaneKey: sanitizeActivityClearedAtByPaneKey(ui.activityClearedAtByPaneKey),
    manuallyUnreadTurnsByPaneKey: sanitizePaneKeyTimestampRecord(ui.manuallyUnreadTurnsByPaneKey)
  }
}
