import type { WebSocket } from 'ws'
import {
  createWsOutboundBackpressureQueue,
  type WsOutboundBackpressureQueue
} from '../../../shared/ws-outbound-backpressure-queue'
import {
  REMOTE_RUNTIME_MAX_OUTBOUND_BINARY_FRAME_BYTES,
  REMOTE_RUNTIME_MAX_OUTBOUND_JSON_BYTES
} from '../../../shared/remote-runtime-memory-limits'
import type {
  RuntimeE2EEOutboundMemoryBudget,
  RuntimeE2EEOutboundSocketMemory
} from './runtime-e2ee-outbound-memory-budget'

export function runtimeE2EETextPayloadAdmissionBytes(value: string): number {
  const bytes = Buffer.byteLength(value, 'utf8')
  return bytes <= REMOTE_RUNTIME_MAX_OUTBOUND_JSON_BYTES ? bytes : Number.POSITIVE_INFINITY
}

export function isRuntimeE2EETextPayloadWithinLimit(value: string): boolean {
  return Number.isFinite(runtimeE2EETextPayloadAdmissionBytes(value))
}

export function runtimeE2EEBinaryPayloadAdmissionBytes(value: Uint8Array<ArrayBufferLike>): number {
  return value.byteLength <= REMOTE_RUNTIME_MAX_OUTBOUND_BINARY_FRAME_BYTES
    ? value.byteLength
    : Number.POSITIVE_INFINITY
}

export function isRuntimeE2EEBinaryPayloadWithinLimit(value: Uint8Array<ArrayBufferLike>): boolean {
  return Number.isFinite(runtimeE2EEBinaryPayloadAdmissionBytes(value))
}

export function createRuntimeE2EETextReplyQueue(args: {
  ws: WebSocket
  isKeyed: () => boolean
  onOverflow: () => void
  memoryBudget: RuntimeE2EEOutboundMemoryBudget
  socketMemory: RuntimeE2EEOutboundSocketMemory
}): WsOutboundBackpressureQueue<string> {
  return createWsOutboundBackpressureQueue<string>({
    send: (frame) => args.ws.send(frame),
    // Encrypted replies are base64 ASCII strings, so length === byte count.
    byteLengthOf: (frame) => frame.length,
    getBufferedAmount: () => args.ws.bufferedAmount,
    isWritable: () => args.isKeyed() && args.ws.readyState === args.ws.OPEN,
    canSend: (bytes) => args.socketMemory.canSend(bytes),
    claimQueuedBytes: (bytes) => args.memoryBudget.claimQueuedBytes(bytes),
    onOverflow: args.onOverflow
  })
}
