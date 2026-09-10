import {
  kontextOntologyConfigRequestSchema,
  kontextOntologyEmbedResultSchema,
  kontextOntologyEmbeddingRequestSchema,
  kontextOntologyEmbeddingResultSchema
} from '../../../../shared/kontext-ontology-contract'
import { defineMethod } from '../core'
import { runKontextOntology as run, sidecarDataDirectory } from './kontext-ontology-run'

/**
 * How knowledge search embeds text, chosen per workspace and recorded beside the
 * graph. Neither method touches the ontology; embed only fills in vectors for
 * chunks that have none in the chosen space.
 */
export const kontextOntologyEmbeddingMethod = defineMethod({
  name: 'kontext.setEmbedding',
  params: kontextOntologyEmbeddingRequestSchema,
  handler: async (
    { workspacePath, provider, model, baseUrl, apiKeyEnv, apply },
    { runtime, signal }
  ) => {
    // Why the data directory: search reads the recorded choice from there, so a change
    // must land beside the graph as well as in kontext.yaml.
    const args = ['embedding', '--provider', provider, '--data-dir', sidecarDataDirectory()]
    if (model) {
      args.push('--model', model)
    }
    if (baseUrl) {
      args.push('--base-url', baseUrl)
    }
    if (apiKeyEnv) {
      args.push('--api-key-env', apiKeyEnv)
    }
    if (apply) {
      args.push('--write')
    }
    return run(workspacePath, args, kontextOntologyEmbeddingResultSchema, runtime, signal)
  }
})

export const kontextOntologyEmbedMethod = defineMethod({
  name: 'kontext.embedKnowledge',
  params: kontextOntologyConfigRequestSchema,
  handler: async ({ workspacePath }, { runtime, signal }) =>
    run(
      workspacePath,
      ['embed', '--data-dir', sidecarDataDirectory()],
      kontextOntologyEmbedResultSchema,
      runtime,
      signal
    )
})
