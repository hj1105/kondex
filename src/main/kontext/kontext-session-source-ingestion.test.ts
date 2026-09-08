import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { request as httpRequest } from 'node:http'
import { afterEach, expect, it } from 'vitest'
import { z } from 'zod'
import {
  kontextMarkdownSourceResultSchema,
  kontextSourceInspectionSchema,
  kontextSourceInventorySchema
} from '../../shared/kontext-source-contract'
import { openAgentSessionJournal } from '../native-chat/agent-session-journal/journal-store-factory'
import { hostTestAttachParams } from '../native-chat/agent-session-wire/structured-agent-session-host-test-data'
import { readStructuredAgentSessionSourceSnapshot } from '../native-chat/agent-session-wire/structured-agent-session-source-snapshot'
import { previewKontextNativeSessionSource } from './kontext-native-session-source'
import { KontextSessionSourceBridge } from './kontext-session-source-bridge'
import { KontextSidecarService } from './kontext-sidecar-service'

const roots: string[] = []
const owners: { close(): Promise<void> }[] = []
afterEach(async () => {
  await Promise.all(owners.splice(0).map((owner) => owner.close()))
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true })))
})
async function fixture(provider: 'codex' | 'claude' = 'codex') {
  const root = await mkdtemp(join(tmpdir(), 'kondex-source-bridge-'))
  roots.push(root)
  const journal = await openAgentSessionJournal({
    identity: {
      sessionId: 'session-one',
      workspaceId: 'folder-one',
      hostId: 'local',
      agent: provider,
      providerHandle:
        provider === 'codex'
          ? { kind: 'codex', threadId: 'thread-one' }
          : { kind: 'claude', sessionId: 'session-one', leafUuid: null }
    },
    journalDir: join(root, 'journal'),
    autoCompact: false
  })
  const base = hostTestAttachParams(null)
  const params = hostTestAttachParams(null, {
    provider,
    envelope: { ...base.envelope, sessionId: 'session-one' },
    location: {
      executionHostId: 'local',
      workspaceId: 'folder-one',
      workspaceKind: 'folder',
      wslDistro: null
    }
  })
  const host = {
    readJournalSnapshot: () => readStructuredAgentSessionSourceSnapshot({ journal, params })
  }
  let ordinal = 0
  const add = (text: string) =>
    journal.appendItem(
      provider === 'codex'
        ? { provider, threadId: 'thread-one', turnId: 'turn-one', ordinal: ordinal++ }
        : { provider, sessionId: 'session-one', uuid: `message-${ordinal++}` },
      { kind: 'message', role: 'user', blocks: [{ type: 'text', text }] },
      { fence: 1 }
    )
  await add('Keep the existing domain term')
  return {
    root,
    add,
    read: (runtimeId = 'runtime-one') =>
      previewKontextNativeSessionSource(runtimeId, host, 'session-one')
  }
}
async function descriptor(root: string) {
  return z
    .object({ endpoint: z.string(), token: z.string(), runtimeId: z.string() })
    .parse(
      JSON.parse(
        await readFile(join(root, 'kontext', 'knowledge', 'native-source-reader.json'), 'utf8')
      )
    )
}

it('serves only authenticated native reads and leaves replacement readers intact on old-owner shutdown', async () => {
  const h = await fixture()
  const old = new KontextSessionSourceBridge({
    dataDirectory: join(h.root, 'kontext'),
    runtimeId: 'runtime-one',
    read: () => h.read()
  })
  owners.push(old)
  await Promise.all([old.start(), old.start()])
  const first = await descriptor(h.root)
  if (process.platform !== 'win32') {
    expect(
      (await stat(join(h.root, 'kontext', 'knowledge', 'native-source-reader.json'))).mode & 0o777
    ).toBe(0o600)
  }
  const rejectedHeaders: Record<string, string>[] = [
    {},
    { authorization: `Bearer ${'a'.repeat(64)}` },
    { authorization: `Bearer ${first.token}`, origin: 'https://example.com' }
  ]
  for (const headers of rejectedHeaders) {
    expect((await fetch(first.endpoint, { method: 'POST', headers })).status).toBe(403)
  }
  const wrongHost = await new Promise<number | undefined>((resolve, reject) => {
    const request = httpRequest(
      first.endpoint,
      { method: 'POST', headers: { authorization: `Bearer ${first.token}`, host: 'example.com' } },
      (response) => {
        response.resume()
        resolve(response.statusCode)
      }
    )
    request.on('error', reject)
    request.end()
  })
  expect(wrongHost).toBe(403)
  const requestId = randomUUID()
  const response = await fetch(first.endpoint, {
    method: 'POST',
    headers: { authorization: `Bearer ${first.token}` },
    body: JSON.stringify({ requestId, sessionId: 'session-one' })
  })
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(await response.json()).toEqual({ requestId, source: h.read() })
  const replacement = new KontextSessionSourceBridge({
    dataDirectory: join(h.root, 'kontext'),
    runtimeId: 'runtime-two',
    read: () => h.read('runtime-two')
  })
  owners.push(replacement)
  await replacement.start()
  const next = await descriptor(h.root)
  await old.close()
  expect(await descriptor(h.root)).toEqual(next)
  await expect(old.start()).rejects.toThrow('closed')
  await expect(fetch(first.endpoint)).rejects.toThrow()
  expect(
    (
      await fetch(next.endpoint, {
        method: 'POST',
        headers: { authorization: `Bearer ${first.token}` }
      })
    ).status
  ).toBe(403)
  await replacement.close()
  await expect(fetch(next.endpoint)).rejects.toThrow()
})

it.skipIf(!process.env.KONDEX_KONTEXT_SIDECAR_PATH).each(['codex', 'claude'] as const)(
  'registers a real %s journal through the actual MCP bundle, revokes changed grants and recovers after app restart',
  async (provider) => {
    const h = await fixture(provider)
    const makeService = (runtimeId: string) => {
      const service = new KontextSidecarService({
        userDataPath: h.root,
        environment: {
          KONDEX_KONTEXT_SIDECAR_PATH: process.env.KONDEX_KONTEXT_SIDECAR_PATH,
          PATH: '',
          HOME: h.root,
          USERPROFILE: h.root,
          APPDATA: h.root,
          LOCALAPPDATA: h.root,
          CODEX_HOME: h.root,
          CLAUDE_CONFIG_DIR: h.root
        },
        executablePath: process.execPath
      })
      service.configureSessionSourceReader(runtimeId, () => h.read(runtimeId))
      owners.push(service)
      return service
    }
    const service = makeService('runtime-one')
    const preview = h.read()
    const source = kontextMarkdownSourceResultSchema.parse(
      await service.callTool('kontext_register_session_source', {
        origin: preview.origin,
        expectedContentDigest: preview.contentDigest,
        hostToken: 'forged'
      })
    )
    expect(source).toMatchObject({
      contentHash: preview.contentDigest,
      providerSharing: 'not_granted',
      normativeApproval: 'not_granted'
    })
    const identity = { resourceId: source.resourceId }
    const inspect = async (active = service) =>
      kontextSourceInspectionSchema.parse(await active.callTool('kontext_inspect_source', identity))
    expect(await inspect()).toMatchObject({
      sourceKind: 'native_session',
      nativeSession: preview.origin,
      sharing: null
    })
    const oldClientInventory = kontextSourceInventorySchema.parse(
      await service.callTool('kontext_list_sources', {})
    )
    expect(oldClientInventory.sources).toEqual([])
    const inventory = kontextSourceInventorySchema.parse(
      await service.callTool('kontext_list_sources', { includeNativeSessions: true })
    )
    expect(inventory.sources).toHaveLength(1)
    await service.callTool('kontext_set_source_sharing', {
      ...identity,
      expectedRevision: 1,
      expectedContentHash: source.contentHash,
      dataClassification: 'internal',
      allowedRuntimeProviders: [provider]
    })
    expect((await inspect()).sharing?.allowedRuntimeProviders).toEqual([provider])
    await h.add('Use the updated decision')
    await expect(
      service.callTool('kontext_register_session_source', {
        origin: preview.origin,
        expectedContentDigest: preview.contentDigest
      })
    ).rejects.toThrow()
    expect((await inspect()).status).toBe('stale')
    await service.callTool('kontext_refresh_source', identity)
    expect(await inspect()).toMatchObject({
      status: 'active',
      sharing: null,
      contentHash: h.read().contentDigest
    })
    const beforeRestart = await descriptor(h.root)
    await service.close()
    await expect(fetch(beforeRestart.endpoint)).rejects.toThrow()
    const restarted = makeService('runtime-two')
    const refreshed = kontextMarkdownSourceResultSchema.parse(
      await restarted.callTool('kontext_refresh_source', identity)
    )
    expect(refreshed.resourceId).toBe(source.resourceId)
    expect(refreshed.contentHash).toBe(h.read('runtime-two').contentDigest)
    expect(await inspect(restarted)).toMatchObject({
      status: 'active',
      nativeSession: { runtimeId: 'runtime-two' },
      sharing: null
    })
  }
)
