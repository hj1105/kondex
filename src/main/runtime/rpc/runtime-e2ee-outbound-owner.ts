import type { WebSocket } from 'ws'
import type { WsOutboundBackpressureQueue } from '../../../shared/ws-outbound-backpressure-queue'
import { createRuntimeE2EETextReplyQueue } from './runtime-e2ee-outbound-admission'
import {
  createRuntimeE2EEOutboundMemoryBudget,
  type RuntimeE2EEOutboundMemoryBudget,
  type RuntimeE2EEOutboundSocketMemory
} from './runtime-e2ee-outbound-memory-budget'

export class RuntimeE2EEOutboundOwner {
  private readonly memoryBudget: RuntimeE2EEOutboundMemoryBudget
  private readonly socketMemory: RuntimeE2EEOutboundSocketMemory | null
  private legacyQueue: WsOutboundBackpressureQueue<string> | null = null

  constructor(
    private readonly ws: WebSocket,
    memoryBudget: RuntimeE2EEOutboundMemoryBudget = createRuntimeE2EEOutboundMemoryBudget()
  ) {
    this.memoryBudget = memoryBudget
    this.socketMemory = memoryBudget.registerBufferedAmount(() => ws.bufferedAmount)
  }

  canSend(bytes: number): boolean {
    return this.socketMemory?.canSend(bytes) === true
  }

  sendLegacyFrame(frame: string, onOverflow: () => void): boolean {
    if (!this.canSend(frame.length) || this.ws.readyState !== this.ws.OPEN) {
      onOverflow()
      return false
    }
    this.ws.send(frame)
    return true
  }

  enqueueLegacyText(frame: string, isKeyed: () => boolean, onOverflow: () => void): boolean {
    if (!this.socketMemory) {
      onOverflow()
      return false
    }
    this.legacyQueue ??= createRuntimeE2EETextReplyQueue({
      ws: this.ws,
      isKeyed,
      memoryBudget: this.memoryBudget,
      socketMemory: this.socketMemory,
      onOverflow
    })
    return this.legacyQueue.enqueue(frame)
  }

  dispose(): void {
    this.legacyQueue?.dispose()
    this.legacyQueue = null
    this.socketMemory?.release()
  }
}
