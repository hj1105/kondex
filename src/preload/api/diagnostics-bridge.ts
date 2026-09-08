import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'

export const diagnosticsApi = {
  getStatus: () => ipcRenderer.invoke('diagnostics:getStatus'),
  collectBundle: (lookbackMinutes?: number) =>
    ipcRenderer.invoke('diagnostics:collectBundle', lookbackMinutes),
  openBundlePreview: (bundleId: string): Promise<void> =>
    ipcRenderer.invoke('diagnostics:openBundlePreview', bundleId),
  discardBundlePreview: (bundleId: string): Promise<void> =>
    ipcRenderer.invoke('diagnostics:discardBundlePreview', bundleId)
} satisfies PreloadApi['diagnostics']
