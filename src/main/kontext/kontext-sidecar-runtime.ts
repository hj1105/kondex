import { getCanonicalUserDataPath } from '../persistence'
import { KontextSidecarService } from './kontext-sidecar-service'
import { getStructuredAgentSessionHost } from '../native-chat/agent-session-wire/structured-agent-session-registry'
import { previewKontextNativeSessionSource } from './kontext-native-session-source'

let service: KontextSidecarService | null = null

export function getKontextSidecarService(runtimeId?: string): KontextSidecarService {
  if (!service) {
    service = new KontextSidecarService({
      userDataPath: getCanonicalUserDataPath(),
      resourcesPath: readElectronResourcesPath(),
      environment: process.env,
      executablePath: process.execPath
    })
  }
  if (runtimeId) {
    service.configureSessionSourceReader(runtimeId, (sessionId) => {
      const host = getStructuredAgentSessionHost()
      if (!host) {
        throw new Error('Native session source host unavailable')
      }
      return previewKontextNativeSessionSource(runtimeId, host, sessionId)
    })
  }
  return service
}

export async function disposeKontextSidecarService(): Promise<void> {
  const current = service
  service = null
  await current?.close()
}

function readElectronResourcesPath(): string | undefined {
  const value = (process as NodeJS.Process & { resourcesPath?: unknown }).resourcesPath
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}
