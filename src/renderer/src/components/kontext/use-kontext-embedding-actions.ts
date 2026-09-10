import { useCallback } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import {
  type KontextEmbeddingProvider,
  kontextOntologyEmbedResultSchema,
  kontextOntologyEmbeddingResultSchema
} from '../../../../shared/kontext-ontology-contract'
import { pollOntologyProgress } from './kontext-ontology-progress-poll'
import type { OntologyAction, OntologyState } from './kontext-ontology-state'
import type { KontextRequestOwner } from './kontext-request-journal'

/**
 * The two search-embedding actions of the ontology page: record which
 * provider embeds text, and give vectors to chunks that have none. Kept apart
 * from the main hook so each file stays readable.
 */
export type EmbeddingInput = {
  provider: KontextEmbeddingProvider
  model?: string
  baseUrl?: string
  apiKeyEnv?: string
}

export type OntologyCall = <T>(
  action: OntologyAction,
  method: string,
  params: Record<string, unknown>,
  parse: (value: unknown) => T,
  timeoutMs: number
) => Promise<T | null>

/** A model download plus embedding can take minutes; the setup budget applies. */
const EMBED_TIMEOUT_MS = 61 * 60 * 1000
const QUICK_TIMEOUT_MS = 61 * 60 * 1000

export function useKontextEmbeddingActions({
  call,
  workspace,
  stableOwner,
  setState
}: {
  call: OntologyCall
  workspace: string
  stableOwner: KontextRequestOwner
  setState: React.Dispatch<React.SetStateAction<OntologyState>>
}) {
  const setEmbedding = useCallback(
    async (input: EmbeddingInput): Promise<boolean> => {
      const result = await call(
        'embedding',
        'kontext.setEmbedding',
        { workspacePath: workspace, apply: true, ...input },
        (value) => kontextOntologyEmbeddingResultSchema.parse(value),
        QUICK_TIMEOUT_MS
      )
      if (!result) {
        return false
      }
      setState((previous) => ({ ...previous, embedding: result.embedding }))
      toast.success(translate('kondex.ontology.embeddingSavedToast', 'Search embedding saved'))
      return true
    },
    [call, setState, workspace]
  )

  const embedKnowledge = useCallback(async (): Promise<void> => {
    const stopPolling = pollOntologyProgress(stableOwner, workspace, (progress) =>
      setState((previous) => ({ ...previous, progress }))
    )
    try {
      const result = await call(
        'embed',
        'kontext.embedKnowledge',
        { workspacePath: workspace },
        (value) => kontextOntologyEmbedResultSchema.parse(value),
        EMBED_TIMEOUT_MS
      )
      if (result) {
        toast.success(
          translate('kondex.ontology.embedDoneToast', 'Embedded {{count}} of {{total}} chunks', {
            count: result.chunksEmbedded,
            total: result.chunksTotal
          })
        )
      }
    } finally {
      stopPolling()
    }
  }, [call, setState, stableOwner, workspace])

  return { setEmbedding, embedKnowledge }
}
