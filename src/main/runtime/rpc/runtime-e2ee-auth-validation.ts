import { publicKeyFromBase64 } from './e2ee-crypto'
import { parseRemoteRuntimeJsonText } from '../../../shared/remote-runtime-request-frames'

export type RuntimeE2EEAuth = {
  type: 'e2ee_auth'
  deviceToken: string
  clientCapabilities?: unknown
}

export function authenticateRuntimeE2EE<TDevice extends { deviceToken: string }>(args: {
  plaintext: string
  resolveDevice: (token: string) => TDevice | null
}):
  | { ok: true; device: TDevice; auth: RuntimeE2EEAuth }
  | { ok: false; code: 'bad_auth' | 'unauthorized' } {
  let auth: RuntimeE2EEAuth
  try {
    auth = parseRemoteRuntimeJsonText(args.plaintext) as RuntimeE2EEAuth
  } catch {
    return { ok: false, code: 'bad_auth' }
  }
  if (auth.type !== 'e2ee_auth' || !auth.deviceToken) {
    return { ok: false, code: 'bad_auth' }
  }
  const device = args.resolveDevice(auth.deviceToken)
  return device?.deviceToken === auth.deviceToken
    ? { ok: true, device, auth }
    : { ok: false, code: 'unauthorized' }
}

export function decodeRuntimeE2EEPublicKey(value: string): Uint8Array | null {
  try {
    return publicKeyFromBase64(value)
  } catch {
    return null
  }
}
