import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { OrcaRuntimeService } from '../../orca-runtime'
import type { StructuredAgentSessionHost } from '../../../native-chat/agent-session-wire/structured-agent-session-host'
import { setStructuredAgentSessionHost } from '../../../native-chat/agent-session-wire/structured-agent-session-registry'
import { STRUCTURED_AGENT_SESSION_RUNTIME_CAPABILITY } from '../../../../shared/protocol-version'
import { RpcDispatcher } from '../dispatcher'
import { kontextSessionSourceMethods } from './kontext-session-source'
import { previewKontextNativeSessionSource } from '../../../kontext/kontext-native-session-source'

const sidecar = vi.hoisted(() => ({ callTool: vi.fn(), get: vi.fn() }))
vi.mock('../../../kontext/kontext-sidecar-runtime', () => ({
  getKontextSidecarService: (runtimeId: string) => {
    sidecar.get(runtimeId)
    return { callTool: sidecar.callTool }
  }
}))

const read = vi.fn<StructuredAgentSessionHost['readJournalSnapshot']>(() => ({
  provider: 'codex',
  location: {
    executionHostId: 'local',
    workspaceId: 'workspace-one',
    workspaceKind: 'folder',
    wslDistro: null
  },
  snapshot: {
    sessionId: 'session-one',
    cursor: { epoch: 'epoch-one', sequence: 1 },
    submissions: [],
    items: [
      {
        itemId: 'message-one',
        sequence: 1,
        revision: 1,
        observedAt: 1,
        body: { kind: 'message', role: 'user', blocks: [{ type: 'text', text: 'Original term' }] }
      }
    ]
  }
}))
const list = vi.fn(() => [
  { sessionId: 'session-one', workspaceId: 'workspace-one', agent: 'codex' }
])
const ensure = vi.fn()
beforeEach(() => {
  sidecar.callTool.mockReset()
  sidecar.get.mockClear()
  read.mockClear()
  list.mockClear()
  ensure.mockClear()
  setStructuredAgentSessionHost({
    readJournalSnapshot: read,
    listSessionTabs: list
  } as unknown as StructuredAgentSessionHost)
})
it('registers only an exact preview from the owning host without caller-provided authority', async () => {
  const preview = previewKontextNativeSessionSource(
    'runtime-host',
    { readJournalSnapshot: read },
    'session-one'
  )
  const registered = {
    organizationId: '00000000-0000-4000-8000-000000000001',
    resourceId: 'resource-one',
    title: 'Session session-one',
    contentHash: preview.contentDigest,
    changed: true,
    evidence: [{ resourceId: 'resource-one', evidenceId: 'evidence-one', chunkId: 'chunk-one' }],
    providerSharing: 'not_granted',
    normativeApproval: 'not_granted'
  }
  sidecar.callTool.mockResolvedValue(registered)
  expect(
    await call('registerSessionSource', {
      sessionId: 'session-one',
      expectedContentDigest: preview.contentDigest,
      origin: { runtimeId: 'forged' },
      body: 'forged',
      hostToken: 'forged'
    })
  ).toMatchObject({ ok: true, result: registered })
  expect(sidecar.get).toHaveBeenCalledExactlyOnceWith('runtime-host')
  expect(sidecar.callTool).toHaveBeenCalledExactlyOnceWith('kontext_register_session_source', {
    origin: preview.origin,
    expectedContentDigest: preview.contentDigest
  })
  expect(ensure).not.toHaveBeenCalled()
})
it('refuses stale previews, unsupported callers and unconfirmed registration results without retries', async () => {
  const preview = previewKontextNativeSessionSource(
    'runtime-host',
    { readJournalSnapshot: read },
    'session-one'
  )
  const request = { sessionId: 'session-one', expectedContentDigest: preview.contentDigest }
  expect(await call('registerSessionSource', request, false)).toMatchObject({ ok: false })
  expect(
    await call('registerSessionSource', {
      ...request,
      expectedContentDigest: `sha256:${'0'.repeat(64)}`
    })
  ).toMatchObject({ ok: false })
  expect(sidecar.callTool).not.toHaveBeenCalled()
  sidecar.callTool.mockResolvedValue({})
  expect(await call('registerSessionSource', request)).toMatchObject({ ok: false })
  expect(sidecar.callTool).toHaveBeenCalledTimes(1)
})
afterEach(() => setStructuredAgentSessionHost(null))
function call(method: string, params: unknown, supported = true, signal?: AbortSignal) {
  return new RpcDispatcher({
    runtime: {
      getRuntimeId: () => 'runtime-host',
      ensureStructuredAgentSessionHost: ensure
    } as unknown as OrcaRuntimeService,
    methods: kontextSessionSourceMethods
  }).dispatch(
    { id: 'test', authToken: 'fixture', method: `kontext.${method}`, params },
    {
      clientKind: 'runtime',
      clientCapabilities: supported ? [STRUCTURED_AGENT_SESSION_RUNTIME_CAPABILITY] : [],
      signal
    }
  )
}
it('derives source identity from the owning host and ignores caller-supplied body or permissions', async () => {
  const result = await call('previewSessionSource', {
    sessionId: 'session-one',
    runtimeId: 'forged',
    body: 'forged text',
    providerSharing: 'granted'
  })
  expect(result).toMatchObject({
    ok: true,
    result: {
      origin: { runtimeId: 'runtime-host', sessionId: 'session-one' },
      providerSharing: 'not_granted',
      normativeApproval: 'not_granted',
      registration: 'not_registered'
    }
  })
  expect(JSON.stringify(result)).not.toContain('forged')
  expect(read).toHaveBeenCalledExactlyOnceWith('session-one')
  expect(ensure).not.toHaveBeenCalled()
})
it('lists only readable native-session metadata without creating the native host or reading bodies', async () => {
  expect(await call('listSessionSources', {})).toMatchObject({
    ok: true,
    result: {
      runtimeId: 'runtime-host',
      scope: 'readable_native_sessions',
      sessions: [{ sessionId: 'session-one' }]
    }
  })
  expect(read).not.toHaveBeenCalled()
  expect(ensure).not.toHaveBeenCalled()
})
it('respects structured-session capability, cancellation and host absence without fallback', async () => {
  expect(await call('previewSessionSource', { sessionId: 'session-one' }, false)).toMatchObject({
    ok: false
  })
  const abort = new AbortController()
  abort.abort()
  expect(await call('listSessionSources', {}, true, abort.signal)).toMatchObject({ ok: false })
  setStructuredAgentSessionHost(null)
  expect(await call('listSessionSources', {})).toMatchObject({ ok: false })
  expect(list).not.toHaveBeenCalled()
  expect(read).not.toHaveBeenCalled()
  expect(ensure).not.toHaveBeenCalled()
})
