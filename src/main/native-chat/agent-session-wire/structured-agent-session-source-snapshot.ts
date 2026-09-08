import type { StructuredAgentSessionHostSession } from './structured-agent-session-host-types'

export function readStructuredAgentSessionSourceSnapshot(
  session: Pick<StructuredAgentSessionHostSession, 'journal' | 'params'>
) {
  if (session.journal.isReadOnly) {
    throw new Error('Session journal is not readable as a complete source')
  }
  const snapshot = session.journal.snapshot()
  if (snapshot.sessionId !== session.params.envelope.sessionId) {
    throw new Error('Session journal source identity mismatch')
  }
  return { location: { ...session.params.location }, provider: session.params.provider, snapshot }
}
