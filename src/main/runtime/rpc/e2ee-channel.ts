// Why: this channel keeps E2EE framing out of RPC handlers, which consume plaintext across transports.
import type { WebSocket } from 'ws'
import { deriveSharedKey, encrypt, decrypt, encryptBytes, decryptBytes } from './e2ee-crypto'
import { authenticateRuntimeE2EE, decodeRuntimeE2EEPublicKey } from './runtime-e2ee-auth-validation'
import {
  isRuntimeE2EEBinaryPayloadWithinLimit,
  isRuntimeE2EETextPayloadWithinLimit
} from './runtime-e2ee-outbound-admission'
import { parseRemoteRuntimeJsonText } from '../../../shared/remote-runtime-request-frames'
import type { RuntimeE2EEOutboundMemoryBudget } from './runtime-e2ee-outbound-memory-budget'
import { RuntimeE2EEOutboundOwner } from './runtime-e2ee-outbound-owner'
import { parseRuntimeClientCapabilities } from './runtime-client-capabilities'
import type { RuntimeCapability } from '../../../shared/protocol-version'
type OutboundBudgetEmitter = 'size' | 'queue'

const HANDSHAKE_TIMEOUT_MS = 10_000
const MAX_CONSECUTIVE_DECRYPT_FAILURES = 5

export type E2EEChannelOptions = {
  serverSecretKey: Uint8Array
  resolveAuthenticatedDevice: (token: string) => E2EEAuthenticatedDevice | null
  onReady: (channel: E2EEChannel, device: E2EEAuthenticatedDevice) => void
  onError: (code: number, reason: string) => void
  outboundMemoryBudget?: RuntimeE2EEOutboundMemoryBudget
}

export type E2EEAuthenticatedDevice = {
  deviceId: string
  deviceToken: string
  scope: 'mobile' | 'runtime'
}

export class E2EEChannel {
  private state: 'awaiting_hello' | 'awaiting_auth' | 'ready' = 'awaiting_hello'
  private sharedKey: Uint8Array | null = null
  private consecutiveFailures = 0
  private handshakeTimer: ReturnType<typeof setTimeout> | null = null
  private readonly ws: WebSocket
  private readonly serverSecretKey: Uint8Array
  private readonly resolveAuthenticatedDevice: (token: string) => E2EEAuthenticatedDevice | null
  private readonly onReady: (channel: E2EEChannel, device: E2EEAuthenticatedDevice) => void
  private readonly onError: (code: number, reason: string) => void
  private readonly outbound: RuntimeE2EEOutboundOwner
  // Why: the handler is set after readiness because its reply closure needs this channel's encryption state.
  private messageHandler:
    | ((
        plaintext: string,
        encryptedReply: (response: string) => void,
        encryptedBinaryReply: (response: Uint8Array<ArrayBufferLike>) => boolean | void
      ) => void)
    | null = null
  private binaryMessageHandler: ((plaintext: Uint8Array<ArrayBufferLike>) => void) | null = null

  deviceToken: string | null = null
  authenticatedDevice: E2EEAuthenticatedDevice | null = null
  clientCapabilities: readonly RuntimeCapability[] = []

  constructor(ws: WebSocket, options: E2EEChannelOptions) {
    this.ws = ws
    this.serverSecretKey = options.serverSecretKey
    this.resolveAuthenticatedDevice = options.resolveAuthenticatedDevice
    this.onReady = options.onReady
    this.onError = options.onError
    this.outbound = new RuntimeE2EEOutboundOwner(ws, options.outboundMemoryBudget)

    this.handshakeTimer = setTimeout(() => {
      this.onError(4002, 'E2EE handshake timeout')
    }, HANDSHAKE_TIMEOUT_MS)
  }

  onMessage(
    handler: (
      plaintext: string,
      encryptedReply: (response: string) => void,
      encryptedBinaryReply: (response: Uint8Array<ArrayBufferLike>) => boolean | void
    ) => void
  ): void {
    this.messageHandler = handler
  }

  onBinaryMessage(handler: (plaintext: Uint8Array<ArrayBufferLike>) => void): void {
    this.binaryMessageHandler = handler
  }

  handleRawMessage(raw: string | Uint8Array<ArrayBufferLike>): void {
    if (this.state === 'awaiting_hello') {
      if (typeof raw !== 'string') {
        this.onError(4001, 'Invalid handshake message')
        return
      }
      this.handleHello(raw)
      return
    }

    const sharedKey = this.sharedKey
    if (!sharedKey) {
      return
    }

    if (typeof raw !== 'string') {
      const plaintextBytes = decryptBytes(raw, sharedKey)
      if (plaintextBytes === null) {
        this.trackDecryptFailure()
        return
      }
      this.consecutiveFailures = 0
      if (this.state !== 'ready') {
        this.onError(4001, 'Invalid binary message before authentication')
        return
      }
      this.binaryMessageHandler?.(plaintextBytes)
      return
    }

    const plaintext = decrypt(raw, sharedKey)
    if (plaintext === null) {
      this.trackDecryptFailure()
      return
    }

    this.consecutiveFailures = 0
    if (this.state === 'awaiting_auth') {
      this.handleAuth(plaintext)
      return
    }

    // Why: streaming emits can outlive destroy(), so late replies must not encrypt with a cleared key.
    const encryptedReply = (response: string) => {
      if (!this.sharedKey || this.ws.readyState !== this.ws.OPEN) {
        return
      }
      if (!isRuntimeE2EETextPayloadWithinLimit(response)) {
        this.closeForOutboundBudget('size')
        return
      }
      this.outbound.enqueueLegacyText(
        encrypt(response, this.sharedKey),
        () => Boolean(this.sharedKey),
        () => this.closeForOutboundBudget('queue')
      )
    }
    const encryptedBinaryReply = (response: Uint8Array<ArrayBufferLike>): boolean => {
      if (!this.sharedKey || this.ws.readyState !== this.ws.OPEN) {
        return false
      }
      if (!isRuntimeE2EEBinaryPayloadWithinLimit(response)) {
        this.closeForOutboundBudget('size')
        return false
      }
      if (!this.outbound.canSend(response.byteLength + 40)) {
        return false
      }
      this.ws.send(Buffer.from(encryptBytes(response, this.sharedKey)), { binary: true })
      return true
    }
    this.messageHandler?.(plaintext, encryptedReply, encryptedBinaryReply)
  }

  private trackDecryptFailure(): void {
    // Why: a wrong key cannot recover on this socket; close so the client uses its bounded auth retry budget.
    if (this.state === 'awaiting_auth') {
      this.onError(4001, 'Unauthorized')
    } else if (++this.consecutiveFailures >= MAX_CONSECUTIVE_DECRYPT_FAILURES) {
      this.onError(4003, 'Too many decryption failures')
    }
  }

  private handleHello(raw: string): void {
    let hello: Record<string, unknown>
    try {
      hello = parseRemoteRuntimeJsonText(raw) as Record<string, unknown>
    } catch {
      this.onError(4001, 'Invalid handshake message')
      return
    }

    if (hello.type !== 'e2ee_hello' || typeof hello.publicKeyB64 !== 'string') {
      this.onError(4001, 'Invalid e2ee_hello')
      return
    }

    // Why: derive the shared key from our secret + client's public key.
    // Both sides compute the same shared secret via ECDH.
    const clientPublicKey = decodeRuntimeE2EEPublicKey(hello.publicKeyB64)
    if (!clientPublicKey) {
      this.onError(4001, 'Invalid public key')
      return
    }

    this.sharedKey = deriveSharedKey(this.serverSecretKey, clientPublicKey)
    this.state = 'awaiting_auth'

    // Why: send e2ee_ready as plaintext — the client needs it to know the
    // key exchange succeeded before it can send encrypted authentication.
    if (this.ws.readyState === this.ws.OPEN) {
      this.ws.send(JSON.stringify({ type: 'e2ee_ready' }))
    }
  }

  private handleAuth(plaintext: string): void {
    const authentication = authenticateRuntimeE2EE({
      plaintext,
      resolveDevice: this.resolveAuthenticatedDevice
    })
    if (!authentication.ok) {
      this.sendEncryptedControl({ type: 'e2ee_error', error: { code: authentication.code } })
      this.onError(4001, authentication.code === 'bad_auth' ? 'Invalid e2ee_auth' : 'Unauthorized')
      return
    }
    const authenticatedDevice = authentication.device

    this.clientCapabilities = parseRuntimeClientCapabilities(authentication.auth.clientCapabilities)
    this.deviceToken = authenticatedDevice.deviceToken
    this.authenticatedDevice = authenticatedDevice
    this.state = 'ready'

    if (this.handshakeTimer) {
      clearTimeout(this.handshakeTimer)
      this.handshakeTimer = null
    }

    // Why: identity checks must complete before the peer sees authentication success.
    this.onReady(this, authenticatedDevice)
    this.sendEncryptedControl({ type: 'e2ee_authenticated' })
  }

  // Why: this close kills the whole remote session. `size` means a producer emitted something
  // too big; `queue` means a backed-up link.
  private closeForOutboundBudget(emitter: OutboundBudgetEmitter): void {
    void emitter
    this.onError(1013, 'Outbound reply buffer overflow')
  }

  private sendEncryptedControl(message: unknown): void {
    if (this.ws.readyState === this.ws.OPEN && this.sharedKey) {
      const frame = encrypt(JSON.stringify(message), this.sharedKey)
      this.outbound.sendLegacyFrame(frame, () => this.closeForOutboundBudget('queue'))
    }
  }

  destroy(): void {
    if (this.handshakeTimer) {
      clearTimeout(this.handshakeTimer)
      this.handshakeTimer = null
    }
    this.sharedKey = null
    this.authenticatedDevice = null
    this.messageHandler = null
    this.binaryMessageHandler = null
    this.outbound.dispose()
  }
}
