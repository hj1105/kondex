import type { DeviceEntry, DeviceRegistry, DeviceScope } from '../device-registry'
import type { E2EEKeypair } from '../e2ee-keypair'
import type { RuntimeE2EESocketWiring } from '../rpc/runtime-e2ee-socket-wiring'
import { encodePairingOffer, PAIRING_OFFER_VERSION } from '../../../shared/pairing'
import type { RuntimePairingReach } from '../../../shared/runtime-pairing-reach'
import { resolveAdvertisedPairingEndpoint } from '../pairing-endpoint'
import { RuntimeRpcNetworkExposure } from './runtime-rpc-network-exposure'
import {
  createWebClientUrl,
  DEVICE_REGISTRY_UNAVAILABLE_GUIDANCE,
  E2EE_KEY_UNAVAILABLE_GUIDANCE,
  pairingUnavailable,
  type PairingOfferUnavailable
} from './runtime-rpc-pairing-types'

export class RuntimeRpcPairing extends RuntimeRpcNetworkExposure {
  getDeviceRegistry(): DeviceRegistry | null {
    return this.deviceRegistry
  }

  getTlsFingerprint(): string | null {
    return this.tlsFingerprint
  }

  getE2EEPublicKey(): string | null {
    return this.e2eeKeypair?.publicKeyB64 ?? null
  }

  getE2EEKeypair(): E2EEKeypair | null {
    return this.e2eeKeypair
  }

  getRuntimeSocketWiring(): RuntimeE2EESocketWiring | null {
    return this.runtimeSocketWiring
  }

  revokeRuntimeAccess(deviceId: string): boolean {
    const device = this.deviceRegistry?.getDevice(deviceId)
    if (device?.scope !== 'runtime' || !this.deviceRegistry?.removeDevice(deviceId)) {
      return false
    }
    this.runtime.forgetClientNavigationState(deviceId)
    this.runtimeSocketWiring?.terminateDeviceConnections(device.token)
    return true
  }

  getWebSocketEndpoint(): string | null {
    const ws = this.transports.find((t) => t.kind === 'websocket')
    return ws?.endpoint ?? null
  }

  createPairingOffer(args: {
    address?: string | null
    name?: string
    rotate?: boolean
    // Accepted for source compatibility; runtime access links can no longer request a mobile scope.
    scope?: 'runtime'
    // Why: STA-2370 — recorded on the grant so a "This computer only" client reconnecting cannot make the
    // next launch bind every interface. Defaults to network reach, which is what every other caller means.
    reach?: RuntimePairingReach
  }):
    | PairingOfferUnavailable
    | {
        available: true
        pairingUrl: string
        endpoint: string
        deviceId: string
        webClientUrl: string | null
      } {
    if (this.pairingInitializationFailure) {
      return this.pairingInitializationFailure
    }
    const rawEndpoint = this.getWebSocketEndpoint()
    if (!rawEndpoint) {
      return pairingUnavailable(
        'websocket_unavailable',
        'WebSocket pairing is unavailable. Inspect preceding runtime errors and choose an unused --port if the listener failed.'
      )
    }
    if (!this.deviceRegistry) {
      return pairingUnavailable('device_registry_unavailable', DEVICE_REGISTRY_UNAVAILABLE_GUIDANCE)
    }
    const publicKeyB64 = this.getE2EEPublicKey()
    if (!publicKeyB64) {
      return pairingUnavailable('e2ee_key_unavailable', E2EE_KEY_UNAVAILABLE_GUIDANCE)
    }

    const advertised = resolveAdvertisedPairingEndpoint(rawEndpoint, args.address)
    if (!advertised.ok) {
      return pairingUnavailable(advertised.reason, advertised.guidance)
    }
    const endpoint = advertised.endpoint
    const deviceName = args.name ?? `CLI ${new Date().toLocaleDateString()}`
    const scope: DeviceScope = 'runtime'
    let device: DeviceEntry
    try {
      const reach = args.reach ?? 'network'
      device = args.rotate
        ? this.deviceRegistry.rotatePendingDevice(deviceName, scope, reach)
        : this.deviceRegistry.getOrCreatePendingDevice(deviceName, scope, reach)
    } catch (error) {
      console.error('[runtime] Failed to persist pairing credential:', error)
      return pairingUnavailable('device_registry_unavailable', DEVICE_REGISTRY_UNAVAILABLE_GUIDANCE)
    }
    const pairingUrl = encodePairingOffer({
      v: PAIRING_OFFER_VERSION,
      endpoint,
      deviceToken: device.token,
      publicKeyB64,
      pairedDeviceId: device.deviceId,
      scope
    })
    return {
      available: true,
      pairingUrl,
      endpoint,
      deviceId: device.deviceId,
      webClientUrl:
        this.webClientRoot && scope === 'runtime' ? createWebClientUrl(endpoint, pairingUrl) : null
    }
  }
}
