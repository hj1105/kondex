import { ipcMain } from 'electron'
import type { RuntimeAccessGrant } from '../../shared/runtime-access-grants'
import { classifyRemotePairingHostname } from '../../shared/remote-pairing-address'
import type { RuntimePairingReach } from '../../shared/runtime-pairing-reach'
import type { DeviceEntry } from '../runtime/device-registry'
import { NETWORK_EXPOSURE_FAILED_GUIDANCE } from '../runtime/network-exposure-guidance'
import {
  getDefaultPairingAddress,
  getPairingNetworkInterfaces,
  type DefaultRouteInterfaceLookup,
  type NetworkInterface
} from '../runtime/pairing-network-interfaces'
import { resolveAdvertisedPairingHostname } from '../runtime/pairing-endpoint'
import type { OrcaRuntimeRpcServer } from '../runtime/runtime-rpc'
import { getWindowsDefaultRouteInterfaceNames } from '../runtime/windows-default-route-interfaces'

const RUNTIME_ACCESS_CHANNELS = [
  'runtimeEnvironments:listLocalNetworkInterfaces',
  'runtimeEnvironments:createLocalAccessLink',
  'runtimeEnvironments:listLocalAccessGrants',
  'runtimeEnvironments:revokeLocalAccessGrant'
] as const

function servesThisComputerOnly(reach: RuntimePairingReach | undefined, address: string): boolean {
  if (reach !== 'this-computer') {
    return false
  }
  const hostname = resolveAdvertisedPairingHostname(address)
  return hostname !== null && classifyRemotePairingHostname(hostname) === 'loopback'
}

function toRuntimeAccessGrant(device: DeviceEntry): RuntimeAccessGrant {
  return {
    deviceId: device.deviceId,
    name: device.name,
    createdAt: device.pairedAt,
    lastSeenAt: device.lastSeenAt > 0 ? device.lastSeenAt : null
  }
}

export type RuntimeAccessHandlerDependencies = {
  getDefaultRouteInterfaceNames?: DefaultRouteInterfaceLookup
}

/** Desktop-only management surface for browser and remote-runtime access grants. */
export function registerRuntimeAccessHandlers(
  rpcServer: OrcaRuntimeRpcServer,
  dependencies: RuntimeAccessHandlerDependencies = {}
): void {
  for (const channel of RUNTIME_ACCESS_CHANNELS) {
    ipcMain.removeHandler(channel)
  }
  const getDefaultRouteInterfaceNames =
    dependencies.getDefaultRouteInterfaceNames ?? getWindowsDefaultRouteInterfaceNames

  ipcMain.handle(
    'runtimeEnvironments:listLocalNetworkInterfaces',
    async (): Promise<{ interfaces: NetworkInterface[] }> => ({
      interfaces: await getPairingNetworkInterfaces(getDefaultRouteInterfaceNames)
    })
  )

  ipcMain.handle(
    'runtimeEnvironments:createLocalAccessLink',
    async (_event, args?: { address?: string; rotate?: boolean; reach?: RuntimePairingReach }) => {
      const address =
        args?.address ?? (await getDefaultPairingAddress(getDefaultRouteInterfaceNames))
      if (!address) {
        return { available: false as const }
      }

      const thisComputerOnly = servesThisComputerOnly(args?.reach, address)
      if (!thisComputerOnly) {
        try {
          await rpcServer.ensureNetworkExposure()
        } catch (error) {
          console.error('[runtime-access] Network exposure failed while creating a link:', error)
          return {
            available: false as const,
            reason: 'network_exposure_failed' as const,
            guidance: NETWORK_EXPOSURE_FAILED_GUIDANCE
          }
        }
      }

      const offer = rpcServer.createPairingOffer({
        address,
        rotate: args?.rotate,
        name: `Runtime ${new Date().toLocaleDateString()}`,
        scope: 'runtime',
        reach: thisComputerOnly ? 'this-computer' : 'network'
      })
      if (!offer.available) {
        return {
          available: false as const,
          reason: offer.reason,
          guidance: offer.guidance
        }
      }
      return offer
    }
  )

  ipcMain.handle('runtimeEnvironments:listLocalAccessGrants', () => {
    const registry = rpcServer.getDeviceRegistry()
    return {
      grants:
        registry
          ?.listDevices()
          .filter((device) => device.scope === 'runtime')
          .sort((a, b) => b.pairedAt - a.pairedAt)
          .map(toRuntimeAccessGrant) ?? []
    }
  })

  ipcMain.handle(
    'runtimeEnvironments:revokeLocalAccessGrant',
    (_event, args: { deviceId: string }) => ({
      revoked: rpcServer.revokeRuntimeAccess(args.deviceId)
    })
  )
}
