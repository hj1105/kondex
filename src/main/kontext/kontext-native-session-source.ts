import { createHash } from 'node:crypto'
import { agentJournalSubmissionKey } from '../../shared/agent-session-journal-item-key'
import {
  kontextSessionSourcePayloadSchema,
  kontextSessionSourcePreviewSchema,
  type KontextSessionSourcePreview
} from '../../shared/kontext-session-source-contract'
import type { StructuredAgentSessionHost } from '../native-chat/agent-session-wire/structured-agent-session-host'

export function previewKontextNativeSessionSource(
  runtimeId: string,
  host: Pick<StructuredAgentSessionHost, 'readJournalSnapshot'>,
  sessionId: string
): KontextSessionSourcePreview {
  const { snapshot, location, provider } = host.readJournalSnapshot(sessionId)
  if (snapshot.sessionId !== sessionId) {
    throw new Error('Session source identity mismatch')
  }
  const unresolved = new Set(
    snapshot.submissions
      .filter((item) => item.dispatchState !== 'accepted')
      .flatMap((item) => [
        agentJournalSubmissionKey(item.clientMessageId),
        ...(item.providerItemId ? [item.providerItemId] : [])
      ])
  )
  const excluded = { items: 0, blocks: 0, unconfirmedSubmissions: 0 }
  const messages: KontextSessionSourcePreview['messages'] = []
  let textBytes = 0
  for (const item of snapshot.items) {
    if (unresolved.has(item.itemId)) {
      excluded.unconfirmedSubmissions++
      continue
    }
    if (
      item.body.kind !== 'message' ||
      (item.body.role !== 'user' && item.body.role !== 'assistant')
    ) {
      excluded.items++
      continue
    }
    const blocks = item.body.blocks.flatMap((block, index) => {
      if (block.type !== 'text' || block.providerFrame || block.text.length === 0) {
        excluded.blocks++
        return []
      }
      textBytes += Buffer.byteLength(block.text, 'utf8')
      if (textBytes > 512 * 1024) {
        throw new Error('Session source exceeds 512 KiB; no partial source was returned')
      }
      return [{ index, text: block.text }]
    })
    if (blocks.length === 0) {
      excluded.items++
      continue
    }
    messages.push({
      itemId: item.itemId,
      revision: item.revision,
      sequence: item.sequence,
      observedAt: item.observedAt,
      recovered: item.recovered === true,
      role: item.body.role,
      blocks
    })
    if (messages.length > 256) {
      throw new Error('Session source exceeds 256 messages; no partial source was returned')
    }
  }
  const payload = kontextSessionSourcePayloadSchema.parse({
    schemaVersion: 1,
    origin: {
      kind: 'kondex_session',
      runtimeId,
      executionHostId: location.executionHostId,
      workspaceId: location.workspaceId,
      workspaceKind: location.workspaceKind,
      wslDistro: location.wslDistro,
      sessionId,
      provider
    },
    journalCursor: snapshot.cursor,
    scope: 'journal_user_assistant_text',
    messages,
    excluded,
    providerSharing: 'not_granted',
    normativeApproval: 'not_granted'
  })
  const bytes = JSON.stringify(payload)
  if (Buffer.byteLength(bytes, 'utf8') > 512 * 1024) {
    throw new Error('Session source exceeds 512 KiB; no partial source was returned')
  }
  return kontextSessionSourcePreviewSchema.parse({
    ...payload,
    contentDigest: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
    registration: 'not_registered'
  })
}
