import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'

export const orcaProfilesApi = {
  list: () => ipcRenderer.invoke('orcaProfiles:list'),
  createLocal: (args) => ipcRenderer.invoke('orcaProfiles:createLocal', args),
  switchProfile: (args) => ipcRenderer.invoke('orcaProfiles:switch', args),
  transferProject: (args) => ipcRenderer.invoke('orcaProfiles:transferProject', args),
  findProjectProfiles: (args) => ipcRenderer.invoke('orcaProfiles:findProjectProfiles', args)
} satisfies PreloadApi['orcaProfiles']
