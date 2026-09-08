import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { openAgentSessionJournal } from '../../../src/main/native-chat/agent-session-journal/journal-store-factory'
import { journalDirectoryFor } from '../../../src/main/native-chat/agent-session-journal/journal-paths'
import { serializeAgentSessionStoreState } from '../../../src/main/runtime/agent-session-store-serialization'
import { AGENT_SESSION_STORE_SCHEMA_VERSION } from '../../../src/main/runtime/agent-session-record-store-file'
import {
  agentSessionLeaseFixture,
  agentSessionRecordFixture
} from '../../../src/shared/agent-session-record.test-fixture'
import {
  isAgentSessionRecord,
  type AgentSessionRecord
} from '../../../src/shared/agent-session-record'

// Seed durable data only: production startup, RPC, journal reads and MCP remain untouched.
export async function seedPersistedSessionSources(profile: string, workspaceId: string) {
  if (!path.basename(profile).startsWith('orca-e2e-restart-')) {
    throw new Error('Native source seeding requires an isolated restart profile')
  }
  const records = new Map<string, AgentSessionRecord>()
  for (const provider of ['codex', 'claude'] as const) {
    const sessionId = `persisted-source-${provider}`
    const record = agentSessionRecordFixture(
      agentSessionLeaseFixture({
        sessionId,
        runtimeKind: 'native',
        claimStatus: 'released',
        ownerProcess: null,
        reservedSpawnToken: null,
        provenHandleLinkId: null
      })
    )
    record.provider = provider
    record.location = {
      executionHostId: 'local',
      wslDistro: null,
      workspaceId,
      workspaceKind: 'folder'
    }
    record.accountHome = {
      variable: provider === 'codex' ? 'CODEX_HOME' : 'CLAUDE_CONFIG_DIR',
      path: path.join(profile, 'unused-provider-home', provider)
    }
    record.providerHandleChain = [
      {
        linkId: `source-${provider}`,
        origin: 'created',
        mintedAtFence: 7,
        observedAt: 1000,
        handle:
          provider === 'codex'
            ? { provider, threadId: sessionId }
            : { provider, sessionId, leafUuid: null }
      }
    ]
    if (!isAgentSessionRecord(record)) {
      throw new Error('Invalid persisted source fixture')
    }
    records.set(sessionId, record)
    const journal = await openAgentSessionJournal({
      identity: {
        sessionId,
        workspaceId: record.location.workspaceId,
        hostId: 'local',
        agent: provider,
        providerHandle:
          provider === 'codex'
            ? { kind: provider, threadId: sessionId }
            : { kind: provider, sessionId, leafUuid: null }
      },
      journalDir: journalDirectoryFor(profile, {
        workspaceId: record.location.workspaceId,
        sessionId
      }),
      autoCompact: false
    })
    await journal.appendItem(
      provider === 'codex'
        ? { provider, threadId: sessionId, turnId: 'source-turn', ordinal: 0 }
        : { provider, sessionId, uuid: 'source-message' },
      {
        kind: 'message',
        role: 'user',
        blocks: [
          {
            type: 'text',
            text: `Keep the original ${provider} domain term.\nEvidence is not approval.`
          }
        ]
      },
      { fence: 7 }
    )
  }
  const directory = path.join(profile, 'agent-sessions')
  await mkdir(directory, { recursive: true })
  await writeFile(
    path.join(directory, 'agent-sessions.json'),
    serializeAgentSessionStoreState({
      schemaVersion: AGENT_SESSION_STORE_SCHEMA_VERSION,
      hostId: 'local',
      records,
      operations: new Map(),
      retiredClaimKeys: [],
      unreadableRecords: new Map(),
      visibleSessionIds: new Set(records.keys()),
      visibleSessionIdsIndexPresent: true
    })
  )
  const bin = path.join(profile, 'blocked-provider-bin')
  const attempted = path.join(profile, 'provider-protocol.jsonl')
  const protocolFixture = await readFile(
    path.resolve('tests/e2e/fixtures/kontext-source-protocol-agent.mjs'),
    'utf8'
  )
  await mkdir(bin)
  for (const provider of ['codex', 'claude']) {
    await writeFile(path.join(bin, provider), `#!${process.execPath}\n${protocolFixture}`, {
      mode: 0o700
    })
  }
  return { bin, attempted }
}
