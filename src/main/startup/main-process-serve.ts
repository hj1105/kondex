import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { resolveAdvertisedPairingEndpoint } from '../runtime/pairing-endpoint'
import { mainProcessState as state } from './main-process-state'
import { getServeOptions, type ServeOptions } from './serve-options'

export { getServeOptions, type ServeOptions }

export function getBundledWebClientRoot(): string | undefined {
  const appPath = app.getAppPath()
  const roots = [
    join(appPath, 'out', 'web'),
    // Why: unpacked electron-vite entrypoints set appPath to out/main, next to the web bundle.
    join(appPath, '..', 'web')
  ]
  return roots.find((root) => existsSync(join(root, 'web-index.html')))
}

export async function printServeReady(options: ServeOptions): Promise<void> {
  const runtime = state.runtime
  const runtimeRpc = state.runtimeRpc
  if (!runtime || !runtimeRpc) {
    throw new Error('Runtime server must be initialized before printing serve readiness')
  }
  const boundEndpoint = runtimeRpc.getWebSocketEndpoint()
  const advertised = boundEndpoint
    ? resolveAdvertisedPairingEndpoint(boundEndpoint, options.pairingAddress)
    : null
  const pairing = options.noPairing
    ? ({
        available: false,
        reason: 'disabled_by_operator',
        guidance: 'Restart without --no-pairing to create a client pairing offer.'
      } as const)
    : runtimeRpc.createPairingOffer({
        address: options.pairingAddress,
        name: `CLI ${new Date().toLocaleDateString()}`,
        scope: 'runtime'
      })
  await state.serveReadinessPublisher.publish(
    {
      runtimeId: runtime.getRuntimeId(),
      boundEndpoint,
      advertisedEndpoint: advertised?.ok ? advertised.endpoint : null,
      // Why: the WSL reconciliation barrier fails open, so 'pending' warns a WSL PTY launch may still race a repair.
      managedWslCliReconciliation: state.managedWslCliReconciliationStatus,
      pairing: pairing.available
        ? {
            available: true,
            url: pairing.pairingUrl,
            endpoint: pairing.endpoint,
            deviceId: pairing.deviceId,
            webClientUrl: pairing.webClientUrl,
            scope: 'runtime'
          }
        : pairing
    },
    { mode: options.json ? 'json' : 'human' }
  )
}
