import { ipcMain } from 'electron'
import type { Store } from '../persistence'
import type { AutomationService } from '../automations/service'
import type {
  AutomationDispatchResult,
  AutomationPrecheckResult,
  AutomationRun
} from '../../shared/automations-types'

export function registerAutomationHandlers(store: Store, service: AutomationService): void {
  ipcMain.handle(
    'automations:runPrecheck',
    (
      _event,
      args: { automationId: string; runId: string }
    ): Promise<AutomationPrecheckResult | null> =>
      service.runPrecheck(args.automationId, args.runId)
  )
  ipcMain.handle(
    'automations:markDispatchResult',
    (_event, result: AutomationDispatchResult): Promise<AutomationRun> =>
      service.markDispatchResult(result)
  )
  ipcMain.handle(
    'automations:snapshotWorkspaceName',
    (_event, args: { workspaceId: string; displayName: string }): number =>
      store.snapshotAutomationRunWorkspaceDisplayName(args.workspaceId, args.displayName)
  )
  ipcMain.handle('automations:rendererReady', (): void => {
    service.setRendererReady()
  })
}
