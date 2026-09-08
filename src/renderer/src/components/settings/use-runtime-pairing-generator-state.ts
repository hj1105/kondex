import { useRef, useState } from 'react'
import { useMountedRef } from '@/hooks/useMountedRef'
import type { RuntimeAccessGrant } from '../../../../shared/runtime-access-grants'
import { runtimePairingLinkCache, type RuntimePairingIntent } from './runtime-pairing-link-state'

/**
 * The generator's local state, kept beside the link-state module the component
 * already shares with its form. Seeded from the module-level cache so the panel
 * shows the last generated link when it remounts.
 */
export function useRuntimePairingGeneratorState() {
  const [networkInterfaces, setNetworkInterfaces] = useState<{ name: string; address: string }[]>(
    []
  )
  const [selectedAddress, setSelectedAddress] = useState(runtimePairingLinkCache.selectedAddress)
  const [intent, setIntent] = useState<RuntimePairingIntent>(runtimePairingLinkCache.intent)
  const [generatedAddress, setGeneratedAddress] = useState<string | null>(
    runtimePairingLinkCache.generatedAddress
  )
  const [runtimePairingUrl, setRuntimePairingUrl] = useState<string | null>(
    runtimePairingLinkCache.runtimePairingUrl
  )
  const [webClientUrl, setWebClientUrl] = useState<string | null>(
    runtimePairingLinkCache.webClientUrl
  )
  const [runtimePairingDeviceId, setRuntimePairingDeviceId] = useState<string | null>(
    runtimePairingLinkCache.runtimePairingDeviceId
  )
  const [runtimeAccessGrants, setRuntimeAccessGrants] = useState<RuntimeAccessGrant[]>([])
  const [isLoadingAccessGrants, setIsLoadingAccessGrants] = useState(false)
  const [refreshingNetworkInterfaces, setRefreshingNetworkInterfaces] = useState(false)
  const [revokingGrantId, setRevokingGrantId] = useState<string | null>(null)
  const [copiedTarget, setCopiedTarget] = useState<'web' | 'pairing' | null>(null)
  const [isGeneratingPairing, setIsGeneratingPairing] = useState(false)

  return {
    networkInterfaces,
    setNetworkInterfaces,
    selectedAddress,
    setSelectedAddress,
    intent,
    setIntent,
    generatedAddress,
    setGeneratedAddress,
    runtimePairingUrl,
    setRuntimePairingUrl,
    webClientUrl,
    setWebClientUrl,
    runtimePairingDeviceId,
    setRuntimePairingDeviceId,
    runtimeAccessGrants,
    setRuntimeAccessGrants,
    isLoadingAccessGrants,
    setIsLoadingAccessGrants,
    refreshingNetworkInterfaces,
    setRefreshingNetworkInterfaces,
    revokingGrantId,
    setRevokingGrantId,
    copiedTarget,
    setCopiedTarget,
    isGeneratingPairing,
    setIsGeneratingPairing,
    networkInterfaceLoadIdRef: useRef(0),
    accessGrantLoadIdRef: useRef(0),
    copiedTargetResetTimerRef: useRef<number | null>(null),
    mountedRef: useMountedRef()
  }
}
