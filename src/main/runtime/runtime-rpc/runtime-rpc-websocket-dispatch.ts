import type { WebSocket } from 'ws'
import { fingerprintAuthenticatedPairingCredential } from '../rpc/orchestration-mutation-executor'
import type { AuthenticatedRuntimeSocket } from '../rpc/runtime-e2ee-socket-wiring'
import type { RpcRequest, RpcResponse } from '../rpc/core'
import type { WebSocketTransport } from '../rpc/ws-transport'
import type { DeviceScope } from '../device-registry'
import { RuntimeRpcRequestAdmission } from './runtime-rpc-request-admission'
import { classifyRuntimeLongPoll } from './runtime-rpc-long-poll'

// Why: status.get has no per-connection context in the dispatcher, so stamp the scope here at the transport boundary.
function injectDeviceScope(response: string, scope: DeviceScope): string {
  try {
    const parsed = JSON.parse(response) as RpcResponse
    if (parsed.ok !== true || typeof parsed.result !== 'object' || parsed.result === null) {
      return response
    }
    ;(parsed.result as Record<string, unknown>).deviceScope = scope
    return JSON.stringify(parsed)
  } catch {
    return response
  }
}

export class RuntimeRpcWebSocketDispatch extends RuntimeRpcRequestAdmission {
  // Why: WebSocket dispatch is streaming (multiple responses) and auths via per-device tokens, not the shared token.
  protected async handleWebSocketMessage(
    rawMessage: string,
    reply: (response: string) => void,
    sendBinary: (response: Uint8Array<ArrayBufferLike>) => boolean | void,
    wsTransport?: WebSocketTransport,
    ws?: WebSocket,
    authenticatedDeviceToken?: string | null,
    authenticatedSocket?: AuthenticatedRuntimeSocket
  ): Promise<void> {
    let request: RpcRequest
    try {
      request = JSON.parse(rawMessage) as RpcRequest
    } catch {
      reply(JSON.stringify(this.buildError('unknown', 'bad_request', 'Invalid JSON request')))
      return
    }

    if (typeof request.id !== 'string' || request.id.length === 0) {
      reply(JSON.stringify(this.buildError('unknown', 'bad_request', 'Missing request id')))
      return
    }
    if (typeof request.method !== 'string' || request.method.length === 0) {
      reply(JSON.stringify(this.buildError(request.id, 'bad_request', 'Missing RPC method')))
      return
    }

    const requestToken =
      typeof (request as Record<string, unknown>).deviceToken === 'string'
        ? ((request as Record<string, unknown>).deviceToken as string)
        : null
    if (authenticatedDeviceToken && requestToken && requestToken !== authenticatedDeviceToken) {
      reply(JSON.stringify(this.buildError(request.id, 'unauthorized', 'Device token mismatch')))
      return
    }
    // Why: E2EE already authenticated the channel; authorize by that bound identity, not a repeated request field.
    const token = authenticatedDeviceToken ?? requestToken
    if (!token) {
      reply(JSON.stringify(this.buildError(request.id, 'unauthorized', 'Missing device token')))
      return
    }
    const device = this.deviceRegistry?.validateToken(token)
    if (!device) {
      reply(JSON.stringify(this.buildError(request.id, 'unauthorized', 'Invalid device token')))
      return
    }
    if (device.scope !== 'runtime') {
      reply(
        JSON.stringify(
          this.buildError(
            request.id,
            'forbidden',
            'This legacy mobile credential is no longer supported. Create a runtime access link.'
          )
        )
      )
      return
    }

    // Why: bind deviceToken to this socket so ws.on('close') knows which mobile client disconnected.
    if (wsTransport && ws) {
      wsTransport.setClientId(ws, token)
    }

    const longPoll = classifyRuntimeLongPoll(request)
    const rejection = this.admitLongPoll(longPoll, device.deviceId)
    if (rejection) {
      reply(JSON.stringify(this.buildError(request.id, 'runtime_busy', rejection)))
      return
    }

    const abortRegistration = ws ? this.registerWebSocketDispatchAbort(ws) : null

    // Why: older pairings may lack scope metadata, so stamp the authenticated scope onto status.get.
    const replyForRequest =
      request.method === 'status.get'
        ? (response: string): void => reply(injectDeviceScope(response, device.scope))
        : reply

    const connectionId = ws ? this.runtimeSocketWiring?.getConnectionId(ws) : undefined
    try {
      await this.dispatcher.dispatchStreaming(request, replyForRequest, {
        // Why: the validated credential preserves existing federation ownership without trusting request fields.
        authenticatedCallerFingerprint: fingerprintAuthenticatedPairingCredential(token),
        connectionId,
        clientId: token,
        pairedDeviceId: device.deviceId,
        // Why: gates the mobile-only payload diet so full-screen web/desktop clients aren't truncated.
        clientKind: device.scope,
        clientCapabilities: authenticatedSocket?.clientCapabilities,
        signal: abortRegistration?.signal,
        sendBinary,
        registerBinaryStreamHandler: (streamId, handler) =>
          this.registerBinaryStreamHandler(connectionId, streamId, handler),
        registerBinaryMessageHandler: (handler) =>
          this.registerBinaryMessageHandler(connectionId, handler)
      })
    } finally {
      abortRegistration?.dispose()
      this.releaseLongPoll(longPoll, device.deviceId)
    }
  }
}
