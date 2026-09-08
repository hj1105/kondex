import { z } from 'zod'
import {
  PAIRING_CODE_MAX_CHARACTERS,
  PAIRING_DEVICE_TOKEN_MAX_CHARACTERS,
  PAIRING_ENDPOINT_MAX_CHARACTERS,
  PAIRING_INPUT_MAX_CHARACTERS,
  PAIRING_PUBLIC_KEY_MAX_CHARACTERS
} from './pairing-protocol-limits'

export const PAIRING_OFFER_VERSION = 2
export const PairingOfferSchema = z.object({
  v: z.literal(PAIRING_OFFER_VERSION),
  endpoint: z.string().min(1).max(PAIRING_ENDPOINT_MAX_CHARACTERS),
  deviceToken: z.string().min(1).max(PAIRING_DEVICE_TOKEN_MAX_CHARACTERS),
  publicKeyB64: z.string().min(1).max(PAIRING_PUBLIC_KEY_MAX_CHARACTERS),
  pairedDeviceId: z.string().min(1).max(128).optional(),
  scope: z.literal('runtime').optional()
})
export type PairingOffer = z.infer<typeof PairingOfferSchema>

export function encodePairingOffer(offer: PairingOffer): string {
  const json = JSON.stringify(PairingOfferSchema.parse(offer))
  const base64url = Buffer.from(json, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  if (base64url.length > PAIRING_CODE_MAX_CHARACTERS) {
    throw new Error('Pairing offer exceeds safe size')
  }
  // Why: query parameters survive browser and shell handoffs more reliably than fragments.
  return `orca://pair?code=${base64url}`
}

export function decodePairingOffer(url: string): PairingOffer {
  if (url.length > PAIRING_INPUT_MAX_CHARACTERS) {
    throw new Error('Invalid pairing URL: pairing code exceeds safe size')
  }
  const code = extractPairingCodeFromUrl(url)
  if (!code) {
    throw new Error('Invalid pairing URL: must start with orca://pair and include a pairing code')
  }
  return decodePairingBase64(code)
}

function extractPairingCodeFromUrl(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  // Why: prefix checks accepted routes like `orca://pairing?...`; only the
  // pairing deep-link host may carry runtime auth material.
  if (parsed.protocol !== 'orca:' || parsed.hostname !== 'pair') {
    return null
  }
  if (parsed.pathname !== '' && parsed.pathname !== '/') {
    return null
  }
  const code = parsed.searchParams.get('code')
  if (code) {
    return code
  }
  return parsed.hash ? parsed.hash.slice(1) || null : null
}

// Why: accept either an `orca://pair?...` URL or the bare base64 string copied from the host.
export function parsePairingCode(input: string): PairingOffer | null {
  if (input.length > PAIRING_INPUT_MAX_CHARACTERS) {
    return null
  }
  const trimmed = input.trim()
  if (!trimmed) {
    return null
  }
  try {
    if (trimmed.toLowerCase().startsWith('orca://')) {
      return decodePairingOffer(trimmed)
    }
    return decodePairingBase64(trimmed)
  } catch {
    return null
  }
}

function decodePairingBase64(base64url: string): PairingOffer {
  if (
    base64url.length === 0 ||
    base64url.length > PAIRING_CODE_MAX_CHARACTERS ||
    !/^[A-Za-z0-9+/_-]+={0,2}$/.test(base64url)
  ) {
    throw new Error('Invalid pairing code')
  }
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const json =
    typeof Buffer === 'undefined'
      ? new TextDecoder().decode(
          Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
        )
      : Buffer.from(base64, 'base64').toString('utf-8')
  return PairingOfferSchema.parse(JSON.parse(json))
}
