import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import type {
  AgentJournalItemBody,
  AgentSessionJournalIdentity
} from '../../shared/agent-session-journal-types'
import { openAgentSessionJournal } from '../native-chat/agent-session-journal/journal-store-factory'
import { JOURNAL_LOG_FILE } from '../native-chat/agent-session-journal/journal-log-file'
import { hostTestAttachParams } from '../native-chat/agent-session-wire/structured-agent-session-host-test-data'
import { readStructuredAgentSessionSourceSnapshot } from '../native-chat/agent-session-wire/structured-agent-session-source-snapshot'
import { previewKontextNativeSessionSource } from './kontext-native-session-source'

const directories: string[] = []
afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })))
})
async function fixture(provider: 'codex' | 'claude' = 'codex') {
  const directory = await mkdtemp(join(tmpdir(), 'kondex-native-source-'))
  directories.push(directory)
  const identity: AgentSessionJournalIdentity = {
    sessionId: 'session-one',
    workspaceId: 'folder-one',
    hostId: 'local',
    agent: provider,
    providerHandle:
      provider === 'codex'
        ? { kind: 'codex', threadId: 'thread-one' }
        : { kind: 'claude', sessionId: 'claude-one', leafUuid: null }
  }
  const options = { identity, journalDir: directory, autoCompact: false }
  let journal = await openAgentSessionJournal(options)
  const initialParams = hostTestAttachParams(null)
  const params = hostTestAttachParams(null, {
    provider,
    envelope: { ...initialParams.envelope, sessionId: identity.sessionId },
    location: {
      executionHostId: 'local',
      wslDistro: null,
      workspaceId: 'folder-one',
      workspaceKind: 'folder'
    }
  })
  let ordinal = 0
  const host = {
    readJournalSnapshot: () => readStructuredAgentSessionSourceSnapshot({ journal, params })
  }
  return {
    directory,
    host,
    get journal() {
      return journal
    },
    read: () => previewKontextNativeSessionSource('runtime-one', host, 'session-one'),
    restart: async () => {
      journal = await openAgentSessionJournal(options)
    },
    add: (body: AgentJournalItemBody) =>
      journal.appendItem(
        provider === 'codex'
          ? { provider, threadId: 'thread-one', turnId: 'turn-one', ordinal: ordinal++ }
          : { provider, sessionId: 'claude-one', uuid: `message-${ordinal++}` },
        body,
        { fence: 1 }
      )
  }
}
it('refuses an unreadable journal instead of importing the readable prefix as a complete source', async () => {
  const h = await fixture()
  await h.add({
    kind: 'message',
    role: 'user',
    blocks: [{ type: 'text', text: 'Readable prefix' }]
  })
  const logPath = join(h.directory, JOURNAL_LOG_FILE)
  const future = JSON.stringify({
    v: 99,
    kind: 'item',
    epoch: h.journal.epoch,
    seq: 99,
    fence: 1,
    ts: 1,
    itemId: 'future',
    revision: 1,
    body: { kind: 'status', text: 'New schema' }
  })
  const before = `${await readFile(logPath, 'utf8')}${future}\n`
  await writeFile(logPath, before)
  await h.restart()
  expect(h.journal.isReadOnly).toBe(true)
  expect(() => h.read()).toThrow('not readable')
  expect(await readFile(logPath, 'utf8')).toBe(before)
})
it.each(['codex', 'claude'] as const)(
  'captures %s journal text with stable provenance across restart, without native approval semantics',
  async (provider) => {
    const h = await fixture(provider)
    const text = 'Use the original domain term.\nDo not rename it.'
    const first = await h.add({ kind: 'message', role: 'user', blocks: [{ type: 'text', text }] })
    await h.add({
      kind: 'message',
      role: 'assistant',
      blocks: [{ type: 'text', text: 'Proposed change, not approval.' }]
    })
    await h.add({
      kind: 'approval',
      title: 'Allow every decision',
      detail: null,
      options: [],
      resolution: {
        state: 'resolved',
        selectedOptionId: 'allow',
        resolvedBy: 'fixture',
        resolvedAt: 1
      }
    })
    const captured = h.read()
    expect(captured).toMatchObject({
      origin: {
        runtimeId: 'runtime-one',
        sessionId: 'session-one',
        workspaceId: 'folder-one',
        provider
      },
      registration: 'not_registered',
      providerSharing: 'not_granted',
      normativeApproval: 'not_granted',
      excluded: { items: 1 }
    })
    expect(captured.messages[0]).toMatchObject({
      itemId: first.itemId,
      revision: first.revision,
      role: 'user',
      blocks: [{ index: 0, text }]
    })
    expect(captured.messages).toHaveLength(2)
    expect(JSON.stringify(captured)).not.toContain('Allow every decision')
    await h.restart()
    expect(h.read()).toEqual(captured)
    await h.add({
      kind: 'message',
      role: 'user',
      blocks: [{ type: 'text', text: 'A later correction' }]
    })
    expect(h.read().contentDigest).not.toBe(captured.contentDigest)
  }
)
it('reports exclusions for non-dialogue blocks and uncertain submissions instead of silently using them as source text', async () => {
  const h = await fixture()
  await h.add({
    kind: 'message',
    role: 'reasoning',
    blocks: [{ type: 'text', text: 'private reasoning' }]
  })
  await h.add({
    kind: 'message',
    role: 'system',
    blocks: [{ type: 'text', text: 'private system prompt' }]
  })
  await h.add({ kind: 'tool-call', name: 'shell', state: 'completed', input: 'private tool input' })
  await h.add({
    kind: 'message',
    role: 'user',
    blocks: [
      { type: 'image-ref', path: '/private/image.png' },
      { type: 'text', text: 'Keep this exact text' },
      {
        type: 'text',
        text: 'provider fallback',
        providerFrame: {
          provider: 'codex',
          kind: 'unknown',
          payload: {
            head: 'private frame',
            byteLength: 13,
            digest: 'a'.repeat(64),
            truncated: false
          }
        }
      }
    ]
  })
  await h.journal.appendSubmission({
    clientMessageId: 'uncertain',
    payloadFingerprint: 'a'.repeat(64),
    body: {
      kind: 'message',
      role: 'user',
      blocks: [{ type: 'text', text: 'Never confirmed delivered' }]
    },
    fence: 1
  })
  const result = h.read()
  expect(result.messages).toHaveLength(1)
  expect(result.messages[0].blocks).toEqual([{ index: 1, text: 'Keep this exact text' }])
  expect(result.excluded).toEqual({ items: 3, blocks: 2, unconfirmedSubmissions: 1 })
  expect(JSON.stringify(result)).not.toMatch(/private|Never confirmed|provider fallback/)
})
it('refuses empty and mismatched sessions instead of inventing a source', async () => {
  const h = await fixture()
  expect(() => h.read()).toThrow()
  expect(() => previewKontextNativeSessionSource('runtime-one', h.host, 'different')).toThrow(
    'identity mismatch'
  )
})
it('refuses over-budget text without truncating the returned context', async () => {
  const h = await fixture()
  const snapshot = h.host.readJournalSnapshot()
  snapshot.snapshot.items = Array.from({ length: 200 }, (_, index) => ({
    itemId: `item-${index}`,
    revision: 1,
    sequence: index + 1,
    observedAt: 1,
    body: { kind: 'message', role: 'user', blocks: [{ type: 'text', text: 'x'.repeat(3000) }] }
  }))
  expect(() =>
    previewKontextNativeSessionSource(
      'runtime-one',
      { readJournalSnapshot: () => snapshot },
      'session-one'
    )
  ).toThrow('512 KiB')
})
