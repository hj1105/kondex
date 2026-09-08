import { mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { z } from 'zod'
import { openAgentSessionJournal } from '../../../src/main/native-chat/agent-session-journal/journal-store-factory'
import { hostTestAttachParams } from '../../../src/main/native-chat/agent-session-wire/structured-agent-session-host-test-data'
import { readStructuredAgentSessionSourceSnapshot } from '../../../src/main/native-chat/agent-session-wire/structured-agent-session-source-snapshot'
import { previewKontextNativeSessionSource } from '../../../src/main/kontext/kontext-native-session-source'
import { KontextSidecarService } from '../../../src/main/kontext/kontext-sidecar-service'

// The renderer crosses an IPC host double; the journal, source reader and MCP graph are real.
export async function createNativeSourceGuiFixture(provider: 'codex' | 'claude') {
  const root = await mkdtemp(path.join(tmpdir(), 'kondex-native-source-ui-'))
  const sessionId = `session-${provider}`
  const journal = await openAgentSessionJournal({
    identity: {
      sessionId,
      workspaceId: 'folder-fixture',
      hostId: 'local',
      agent: provider,
      providerHandle:
        provider === 'codex'
          ? { kind: 'codex', threadId: sessionId }
          : { kind: 'claude', sessionId, leafUuid: null }
    },
    journalDir: path.join(root, 'journal'),
    autoCompact: false
  })
  let ordinal = 0
  const add = (text: string) =>
    journal.appendItem(
      provider === 'codex'
        ? { provider, threadId: sessionId, turnId: 'fixture-turn', ordinal: ordinal++ }
        : { provider, sessionId, uuid: `message-${ordinal++}` },
      { kind: 'message', role: 'user', blocks: [{ type: 'text', text }] },
      { fence: 1 }
    )
  await add('Keep the original domain term.\nThis is source evidence, not approval.')
  const base = hostTestAttachParams(null)
  const params = hostTestAttachParams(null, {
    provider,
    envelope: { ...base.envelope, sessionId },
    location: {
      executionHostId: 'local',
      workspaceId: 'folder-fixture',
      workspaceKind: 'folder',
      wslDistro: null
    }
  })
  const read = () =>
    previewKontextNativeSessionSource(
      'fixture-runtime',
      { readJournalSnapshot: () => readStructuredAgentSessionSourceSnapshot({ journal, params }) },
      sessionId
    )
  const sidecar = new KontextSidecarService({
    userDataPath: root,
    executablePath: process.execPath,
    environment: {
      KONDEX_KONTEXT_SIDECAR_PATH: path.resolve('resources/kontext/server.mjs'),
      PATH: '',
      HOME: root,
      USERPROFILE: root,
      CODEX_HOME: root,
      CLAUDE_CONFIG_DIR: root
    },
    requestTimeoutMs: 10_000
  })
  sidecar.configureSessionSourceReader('fixture-runtime', read)
  const calls: string[] = []
  const allowed = {
    'kontext.inspectSource': 'kontext_inspect_source',
    'kontext.setSourceSharing': 'kontext_set_source_sharing',
    'kontext.listSources': 'kontext_list_sources'
  } as const
  async function call(method: string, input: unknown) {
    calls.push(method)
    if (method === 'kontext.inspectRuntimes') {
      return { status: 'ready', report: { capabilities: [], issues: [], eligibleProviders: [] } }
    }
    if (method === 'kontext.listSessionSources') {
      return {
        runtimeId: 'fixture-runtime',
        scope: 'readable_native_sessions',
        registrationVersion: 1,
        sessions: [{ sessionId, workspaceId: 'folder-fixture', agent: provider }]
      }
    }
    if (method === 'kontext.previewSessionSource' || method === 'kontext.registerSessionSource') {
      const request = z
        .object({ sessionId: z.literal(sessionId), expectedContentDigest: z.string().optional() })
        .parse(input)
      if (method === 'kontext.previewSessionSource') {
        return read()
      }
      return sidecar.callTool('kontext_register_session_source', {
        origin: read().origin,
        expectedContentDigest: request.expectedContentDigest
      })
    }
    if (method === 'kontext.refreshSource') {
      const request = z.object({ resourceId: z.string() }).parse(input)
      await sidecar.callTool('kontext_refresh_source', request)
      return sidecar.callTool('kontext_inspect_source', request)
    }
    if (Object.hasOwn(allowed, method)) {
      return sidecar.callTool(
        allowed[method as keyof typeof allowed],
        z.record(z.string(), z.unknown()).parse(input)
      )
    }
    throw new Error('Fixture does not implement this method')
  }
  const token = randomBytes(32).toString('hex')
  const server = createServer((request, response) => {
    void (async () => {
      if (request.headers.authorization !== `Bearer ${token}`) {
        response.writeHead(403).end()
        return
      }
      const chunks: Buffer[] = []
      let length = 0
      for await (const chunk of request) {
        length += chunk.length
        if (length > 32 * 1024) {
          throw new Error('Too large')
        }
        chunks.push(chunk)
      }
      const message = z
        .object({ method: z.string(), params: z.unknown().optional() })
        .parse(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      try {
        response.end(
          JSON.stringify({
            id: 'fixture',
            ok: true,
            result: await call(message.method, message.params)
          })
        )
      } catch {
        response.end(
          JSON.stringify({
            id: 'fixture',
            ok: false,
            error: { code: 'operation_failed', message: 'Fixture source operation unavailable' }
          })
        )
      }
    })().catch(() => response.destroy())
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Missing fixture address')
  }
  return {
    sessionId,
    add,
    calls,
    endpoint: `http://127.0.0.1:${address.port}`,
    token,
    close: async () => {
      server.closeAllConnections()
      await new Promise<void>((resolve) => server.close(() => resolve()))
      await sidecar.close()
      await rm(root, { recursive: true })
    }
  }
}
