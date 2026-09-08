import { ipcMain } from 'electron'
import { diagnoseGhAuth } from '../github/auth-diagnose'
import { getAuthenticatedViewer } from '../github/client'
import { getRateLimit } from '../github/rate-limit'

export function registerGitHubAccountHandlers(): void {
  ipcMain.handle('gh:viewer', () => getAuthenticatedViewer())
  ipcMain.handle('gh:rateLimit', (_event, args?: { force?: boolean }) =>
    getRateLimit(args?.force ? { force: true } : undefined)
  )

  ipcMain.handle('gh:diagnoseAuth', (_event, args?: { host?: string }) =>
    diagnoseGhAuth(args?.host)
  )
}
