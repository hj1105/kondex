import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it, vi } from 'vitest'
import {
  ensureStructuredAgentSessionHost,
  stopStructuredAgentSessionRuntime
} from './structured-agent-session-runtime'
import { scanAgentSessionSpawnTokenProcesses } from './agent-session-spawn-token-process-scan'
import type * as SpawnTokenProcessScan from './agent-session-spawn-token-process-scan'

vi.mock('./agent-session-spawn-token-process-scan', async (importOriginal) => ({
  ...(await importOriginal<typeof SpawnTokenProcessScan>()),
  scanAgentSessionSpawnTokenProcesses: vi.fn(
    async () => new Map([['another-profile-token', [202]]])
  )
}))

it.each(['local', 'ssh:test-host'])(
  'does not reap unattributed children at %s host startup',
  async (hostId) => {
    const root = await mkdtemp(join(tmpdir(), 'kondex-startup-isolation-'))
    const signal = vi.spyOn(process, 'kill').mockReturnValue(true)
    const openConnection = vi.fn(() => {
      throw new Error('No provider may start')
    })
    try {
      await ensureStructuredAgentSessionHost({
        stateDirectory: root,
        hostId,
        claimKeyId: 'fixture-key',
        resolveWorkspacePath: async () => root,
        resolveEnvironment: async () => ({}),
        openCodexConnection: openConnection
      })
      await stopStructuredAgentSessionRuntime()
      expect(signal).not.toHaveBeenCalled()
      expect(scanAgentSessionSpawnTokenProcesses).not.toHaveBeenCalled()
      expect(openConnection).not.toHaveBeenCalled()
    } finally {
      await stopStructuredAgentSessionRuntime()
      vi.restoreAllMocks()
      vi.clearAllMocks()
      await rm(root, { recursive: true, force: true })
    }
  }
)
