import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { OrcaRuntimeService } from './orca-runtime'
import { OrcaRuntimeRpcServer } from './runtime-rpc'
import { parsePairingCode } from '../../shared/pairing'
import { waitFor } from './runtime-rpc-test-harness'
import { waitForWsClose, authenticateRuntimeWs } from './runtime-rpc-ws-test-harness'

vi.mock('../git/worktree', () => {
  const worktrees = [
    {
      path: '/tmp/worktree-a',
      head: 'abc',
      branch: 'feature/foo',
      isBare: false,
      isMainWorktree: false
    }
  ]
  return {
    listWorktrees: vi.fn().mockResolvedValue(worktrees),
    listWorktreesStrict: vi.fn().mockResolvedValue(worktrees)
  }
})

describe('OrcaRuntimeRpcServer', () => {
  it('terminates active WebSockets for a revoked runtime access grant', async () => {
    const userDataPath = mkdtempSync(join(tmpdir(), 'orca-runtime-rpc-'))
    const runtime = new OrcaRuntimeService()
    const server = new OrcaRuntimeRpcServer({
      runtime,
      userDataPath,
      enableWebSocket: true,
      wsPort: 0
    })

    await server.start()

    try {
      const offer = server.createPairingOffer({
        address: '127.0.0.1',
        name: 'runtime-test',
        scope: 'runtime'
      })
      expect(offer.available).toBe(true)
      if (!offer.available) {
        throw new Error('WebSocket pairing unavailable')
      }
      const first = await authenticateRuntimeWs(offer.pairingUrl)
      const second = await authenticateRuntimeWs(offer.pairingUrl)

      expect(server.revokeRuntimeAccess(offer.deviceId)).toBe(true)
      await Promise.all([waitForWsClose(first), waitForWsClose(second)])
      await waitFor(
        () =>
          server['runtimeSocketWiring']?.channelCount === 0 &&
          server['runtimeSocketWiring']?.connectionCount === 0
      )

      expect(server.getDeviceRegistry()?.getDevice(offer.deviceId)).toBeNull()
    } finally {
      await server.stop()
    }
  }, 15_000)

  it('rotates unused runtime pairing links without revoking already-used grants', async () => {
    const userDataPath = mkdtempSync(join(tmpdir(), 'orca-runtime-rpc-'))
    const runtime = new OrcaRuntimeService()
    const server = new OrcaRuntimeRpcServer({
      runtime,
      userDataPath,
      enableWebSocket: true,
      wsPort: 0
    })

    await server.start()

    try {
      const first = server.createPairingOffer({
        address: '127.0.0.1',
        name: 'runtime-test',
        rotate: true,
        scope: 'runtime'
      })
      const second = server.createPairingOffer({
        address: '127.0.0.1',
        name: 'runtime-test',
        rotate: true,
        scope: 'runtime'
      })
      expect(first.available).toBe(true)
      expect(second.available).toBe(true)
      if (!first.available || !second.available) {
        throw new Error('WebSocket pairing unavailable')
      }

      expect(first.deviceId).not.toBe(second.deviceId)
      expect(parsePairingCode(first.pairingUrl)?.deviceToken).not.toBe(
        parsePairingCode(second.pairingUrl)?.deviceToken
      )
      expect(server.getDeviceRegistry()?.getDevice(first.deviceId)).toBeNull()

      server.getDeviceRegistry()?.updateLastSeen(second.deviceId)
      const third = server.createPairingOffer({
        address: '127.0.0.1',
        name: 'runtime-test',
        rotate: true,
        scope: 'runtime'
      })
      expect(third.available).toBe(true)
      if (!third.available) {
        throw new Error('WebSocket pairing unavailable')
      }

      expect(server.getDeviceRegistry()?.getDevice(second.deviceId)).not.toBeNull()
      expect(server.getDeviceRegistry()?.getDevice(third.deviceId)).not.toBeNull()
    } finally {
      await server.stop()
    }
  }, 15_000)
})
