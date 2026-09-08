import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AgentSessionRecordStore } from '../../runtime/agent-session-record-store'
import type { StructuredAgentSessionAdapter } from './structured-agent-session-adapter'
import { StructuredAgentSessionHost } from './structured-agent-session-host'
import { StructuredAgentSessionReadableRestorer } from './structured-agent-session-readable-restorer'
import { agentSessionRecordFixture } from '../../../shared/agent-session-record.test-fixture'
import {
  HOST_TEST_NOW,
  HOST_TEST_SESSION,
  hostTestAttachParams,
  resetHostTestOperationIds
} from './structured-agent-session-host-test-data'

const CLAUDE_SESSION = 'claude-session'
const hosts: StructuredAgentSessionHost[] = []
let root = ''

function claudeAdapter(): StructuredAgentSessionAdapter {
  return {
    supportsCreate: (_location, agent) => agent === 'claude',
    acquire: async ({ fence, spawnToken }) => ({
      process: {
        hostId: 'local',
        pid: 4242,
        processStartTimeMs: 1_700_000_000_000,
        spawnToken
      },
      link: {
        linkId: `link-${fence}`,
        handle: { provider: 'claude', sessionId: CLAUDE_SESSION, leafUuid: null },
        origin: 'created',
        mintedAtFence: fence,
        observedAt: HOST_TEST_NOW
      }
    }),
    dispatch: async () => ({ state: 'rejected', reason: 'unused' }),
    cancelTurn: async () => ({ cancelled: false }),
    answerPrompt: async () => undefined,
    setOption: async () => undefined
  }
}

function createHost(
  store: AgentSessionRecordStore,
  probeOwner?: StructuredAgentSessionHost['deps']['probeOwner'],
  adapter: StructuredAgentSessionAdapter = claudeAdapter()
): StructuredAgentSessionHost {
  const host = new StructuredAgentSessionHost({
    store,
    adapter,
    journalRoot: root,
    claimKeyId: 'key-1',
    mintSpawnToken: () => 'spawn-a',
    probeOwner,
    now: () => HOST_TEST_NOW
  })
  hosts.push(host)
  return host
}

afterEach(async () => {
  await Promise.all(hosts.splice(0).map((host) => host.flushAllStreamedEvents()))
  await rm(root, { recursive: true, force: true })
  root = ''
})

describe('structured session provider restore', () => {
  it.each([true, false])(
    'restores a durable Claude journal when execution support is %s',
    async (canExecute) => {
      root = await mkdtemp(join(tmpdir(), 'orca-provider-restore-'))
      resetHostTestOperationIds()
      const storeDirectory = join(root, 'store')
      const store = await AgentSessionRecordStore.open({
        directory: storeDirectory,
        hostId: 'local'
      })
      const host = createHost(store)
      const attached = await host.attach(
        { callerKey: 'client-1' },
        hostTestAttachParams(null, {
          provider: 'claude',
          agent: 'claude',
          accountHome: { variable: 'CLAUDE_CONFIG_DIR', path: '/home/dev/.claude' },
          providerHandle: { kind: 'claude', sessionId: CLAUDE_SESSION, leafUuid: null }
        })
      )
      expect(attached).toMatchObject({ ok: true })

      const reopenedStore = await AgentSessionRecordStore.open({
        directory: storeDirectory,
        hostId: 'local'
      })
      const acquire = vi.fn(claudeAdapter().acquire)
      const originalLease = structuredClone(reopenedStore.getRecord(HOST_TEST_SESSION)?.lease)
      const restarted = createHost(
        reopenedStore,
        async () => ({
          outcome: 'indeterminate',
          reason: 'read does not need ownership'
        }),
        {
          ...claudeAdapter(),
          supportsCreate: (_location, agent) => canExecute && agent === 'claude',
          acquire
        }
      )

      await restarted.restoreReadableSessions()

      expect(restarted.listSessionTabs()).toEqual([
        { sessionId: HOST_TEST_SESSION, workspaceId: 'workspace-1', agent: 'claude' }
      ])
      expect(restarted.readJournalSnapshot(HOST_TEST_SESSION).provider).toBe('claude')
      expect(acquire).not.toHaveBeenCalled()
      expect(restarted.supportsCreate(hostTestAttachParams(null).location, 'claude')).toBe(
        canExecute
      )
      if (!canExecute) {
        expect(reopenedStore.getRecord(HOST_TEST_SESSION)?.lease).toEqual(originalLease)
        await expect(restarted.hold(HOST_TEST_SESSION, 'unsupported-writer')).rejects.toThrow(
          'structured_agent_session_unsupported'
        )
        expect(acquire).not.toHaveBeenCalled()
      }
    }
  )
  it.each([
    { executionHostId: 'ssh:elsewhere' as const, wslDistro: null },
    { executionHostId: 'local' as const, wslDistro: 'Ubuntu' }
  ])(
    'does not substitute local journal reads for unsupported $executionHostId/$wslDistro records',
    async (location) => {
      root = await mkdtemp(join(tmpdir(), 'orca-provider-read-scope-'))
      const record = agentSessionRecordFixture()
      record.location = { ...record.location, ...location }
      const store = await AgentSessionRecordStore.open({
        directory: join(root, 'store'),
        hostId: 'local'
      })
      vi.spyOn(store, 'listRecords').mockReturnValue([record])
      const getRecord = vi.spyOn(store, 'getRecord')
      const reconcile = vi.fn(async () => null)
      const resolveRecovery = vi.fn(async () => undefined)
      const onReadable = vi.fn()
      const restoreHandoff = vi.fn(async () => undefined)
      const reader = new StructuredAgentSessionReadableRestorer({
        store,
        journalRoot: root,
        supportsRecord: () => false,
        reconcile,
        resolveRecovery,
        onReadable,
        restoreHandoff,
        serialize: async (_id, task) => task(),
        hasSession: () => false
      })
      await reader.restore()
      expect(getRecord).not.toHaveBeenCalled()
      expect(reconcile).not.toHaveBeenCalled()
      expect(resolveRecovery).not.toHaveBeenCalled()
      expect(onReadable).not.toHaveBeenCalled()
      expect(restoreHandoff).not.toHaveBeenCalled()
    }
  )
})
