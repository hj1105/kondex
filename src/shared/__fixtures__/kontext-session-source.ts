import type { KontextSessionSourcePreview } from '../kontext-session-source-contract'
// Synthetic UI response only; live-reader tests calculate the digest from real journals.
export const sessionSourcePreviewFixture: KontextSessionSourcePreview = {
  schemaVersion: 1,
  origin: {
    kind: 'kondex_session',
    runtimeId: 'runtime-one',
    executionHostId: 'local',
    workspaceId: 'folder-one',
    workspaceKind: 'folder',
    wslDistro: null,
    sessionId: 'session-one',
    provider: 'codex'
  },
  journalCursor: { epoch: 'epoch-one', sequence: 1 },
  scope: 'journal_user_assistant_text',
  messages: [
    {
      itemId: 'message-one',
      revision: 1,
      sequence: 1,
      observedAt: 1,
      recovered: false,
      role: 'user',
      blocks: [
        {
          index: 0,
          text: 'Keep the original domain term. <img src="https://invalid.test/tracker">'
        }
      ]
    }
  ],
  excluded: { items: 2, blocks: 1, unconfirmedSubmissions: 1 },
  providerSharing: 'not_granted',
  normativeApproval: 'not_granted',
  registration: 'not_registered',
  contentDigest: `sha256:${'a'.repeat(64)}`
}
export const sessionSourceListFixture = {
  runtimeId: 'runtime-one',
  scope: 'readable_native_sessions',
  registrationVersion: 1,
  sessions: [
    { sessionId: 'session-one', workspaceId: 'folder-one', agent: 'codex' },
    { sessionId: 'session-two', workspaceId: 'folder-two', agent: 'claude' }
  ]
}
export const sessionSourceRegistrationFixture = {
  organizationId: '8f424832-cd0f-4582-bfac-360e8704d302',
  resourceId: 'resource:session-one',
  title: 'Session session-one',
  contentHash: sessionSourcePreviewFixture.contentDigest,
  changed: true,
  evidence: [
    {
      resourceId: 'resource:session-one',
      evidenceId: 'evidence:message-one',
      chunkId: 'message-one'
    }
  ],
  providerSharing: 'not_granted',
  normativeApproval: 'not_granted'
}
