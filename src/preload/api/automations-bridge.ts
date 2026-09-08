import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'
import type {
  AutomationDispatchRequest,
  AutomationDispatchResult,
  AutomationRun,
  AutomationPrecheckResult
} from '../../shared/automations-types'
import type { AutomationsChangedPayload } from '../../shared/runtime-client-events'

export const automationsApi = {
  runPrecheck: (args: {
    automationId: string
    runId: string
  }): Promise<AutomationPrecheckResult | null> =>
    ipcRenderer.invoke('automations:runPrecheck', args),
  markDispatchResult: (result: AutomationDispatchResult): Promise<AutomationRun> =>
    ipcRenderer.invoke('automations:markDispatchResult', result),
  snapshotWorkspaceName: (args: { workspaceId: string; displayName: string }): Promise<number> =>
    ipcRenderer.invoke('automations:snapshotWorkspaceName', args),
  rendererReady: (): Promise<void> => ipcRenderer.invoke('automations:rendererReady'),
  onDispatchRequested: (callback: (request: AutomationDispatchRequest) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, request: AutomationDispatchRequest) =>
      callback(request)
    ipcRenderer.on('automations:dispatchRequested', listener)
    return () => ipcRenderer.removeListener('automations:dispatchRequested', listener)
  },
  onChanged: (callback: (payload: AutomationsChangedPayload) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: AutomationsChangedPayload) =>
      callback(payload)
    ipcRenderer.on('automations:changed', listener)
    return () => ipcRenderer.removeListener('automations:changed', listener)
  }
} satisfies PreloadApi['automations']
