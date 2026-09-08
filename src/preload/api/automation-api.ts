import type {
  AutomationDispatchRequest,
  AutomationDispatchResult,
  AutomationPrecheckResult,
  AutomationRun
} from '../../shared/automations-types'
import type { AutomationsChangedPayload } from '../../shared/runtime-client-events'

/**
 * Automation CRUD rides the local runtime RPC surface (`runtime:call`), so this
 * IPC API carries only the desktop-native dispatch-loop plumbing.
 */
export type AutomationsApi = {
  runPrecheck: (args: {
    automationId: string
    runId: string
  }) => Promise<AutomationPrecheckResult | null>
  markDispatchResult: (result: AutomationDispatchResult) => Promise<AutomationRun>
  snapshotWorkspaceName: (args: { workspaceId: string; displayName: string }) => Promise<number>
  rendererReady: () => Promise<void>
  onDispatchRequested: (callback: (request: AutomationDispatchRequest) => void) => () => void
  onChanged: (callback: (payload: AutomationsChangedPayload) => void) => () => void
}
