import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import {
  kontextOntologyProgressSchema,
  type KontextOntologyProgress
} from '../../../../shared/kontext-ontology-contract'
import type { KontextRequestOwner } from './kontext-request-journal'

const PROGRESS_POLL_MS = 2_000

/**
 * Polls the sidecar's progress file while a build runs. The build is one RPC that
 * lasts minutes, so this is how the page can say which phase and batch it is on.
 * Returns the function that stops polling.
 */
export function pollOntologyProgress(
  owner: KontextRequestOwner,
  workspace: string,
  onProgress: (progress: KontextOntologyProgress) => void
): () => void {
  const startedAt = Date.now()
  const poll = setInterval(() => {
    void callRuntimeRpc<unknown>(
      owner,
      'kontext.ontologyProgress',
      { workspacePath: workspace },
      {
        expectedEnvironmentPairingRevision:
          owner.kind === 'environment' ? owner.pairingRevision : undefined,
        timeoutMs: 10_000
      }
    )
      .then((value) => {
        const progress = value === null ? null : kontextOntologyProgressSchema.parse(value)
        // Why the time check: a record left by an earlier build is not this one's progress.
        if (progress && Date.parse(progress.startedAt) >= startedAt - 5_000) {
          onProgress(progress)
        }
      })
      .catch(() => undefined)
  }, PROGRESS_POLL_MS)
  return () => clearInterval(poll)
}
