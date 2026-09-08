import { ipcRenderer } from 'electron'
import type {
  SkillDeletePlan,
  SkillDeleteRequest,
  SkillDeleteResult
} from '../../shared/skill-delete-contract'
import type { SkillDiscoveryResult, SkillDiscoveryTarget } from '../../shared/skills'
import type {
  SkillFreshnessInventory,
  SkillUpdateRun,
  SkillUpdateStartResult
} from '../../shared/skill-freshness'
import type { PreloadApi } from '../api-types'

export const skillsApi = {
  discover: (target?: SkillDiscoveryTarget): Promise<SkillDiscoveryResult> =>
    ipcRenderer.invoke('skills:discover', target),
  freshnessInventory: (): Promise<SkillFreshnessInventory> =>
    ipcRenderer.invoke('skills:freshnessInventory'),
  startUpdateRun: (names: string[]): Promise<SkillUpdateStartResult> =>
    ipcRenderer.invoke('skills:startUpdateRun', names),
  cancelUpdateRun: (): Promise<void> => ipcRenderer.invoke('skills:cancelUpdateRun'),
  acknowledgeUpdateRun: (): Promise<void> => ipcRenderer.invoke('skills:acknowledgeUpdateRun'),
  getUpdateRun: (): Promise<SkillUpdateRun> => ipcRenderer.invoke('skills:getUpdateRun'),
  // Desktop always registers the delete IPC handlers in its own main process.
  deleteSupported: (): Promise<boolean> => Promise.resolve(true),
  previewDelete: (request: SkillDeleteRequest): Promise<SkillDeletePlan> =>
    ipcRenderer.invoke('skills:previewDelete', request),
  delete: (request: SkillDeleteRequest): Promise<SkillDeleteResult> =>
    ipcRenderer.invoke('skills:delete', request),
  onUpdateRun: (callback: (run: SkillUpdateRun) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, run: SkillUpdateRun): void => callback(run)
    ipcRenderer.on('skills:updateRun', listener)
    return () => ipcRenderer.removeListener('skills:updateRun', listener)
  }
} satisfies PreloadApi['skills']
