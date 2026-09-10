import { join } from 'node:path'
import type { z } from 'zod'
import { getAppEnvironment } from '../../../../shared/app-environment'
import { kontextOntologyFailureSchema } from '../../../../shared/kontext-ontology-contract'
import { runKontextOntologyJson } from '../../../kontext/kontext-ontology-cli'

/** Runs one Kontext ontology CLI command in the resolved workspace and parses its JSON answer. */
export type KontextOntologyRuntime = {
  resolveKontextSourceWorkspace: (value: string) => Promise<string>
}

export async function runKontextOntology<Schema extends z.ZodTypeAny>(
  workspace: string,
  args: readonly string[],
  schema: Schema,
  runtime: KontextOntologyRuntime,
  signal: AbortSignal | undefined
): Promise<z.infer<Schema>> {
  signal?.throwIfAborted()
  const workspacePath = await runtime.resolveKontextSourceWorkspace(workspace)
  signal?.throwIfAborted()
  const raw = await runKontextOntologyJson({
    args,
    workspacePath,
    ...(signal ? { signal } : {})
  })
  // Why: a reported failure names the source or field at fault, so it is passed
  // through as a result rather than collapsed into a generic RPC error.
  const failure = kontextOntologyFailureSchema.safeParse(raw)
  if (failure.success) {
    throw new Error(failure.data.error)
  }
  return schema.parse(raw)
}

/** Where the Task sidecar keeps its knowledge graph, models and recorded settings. */
export function sidecarDataDirectory(): string {
  return join(getAppEnvironment().getPath('userData'), 'kontext')
}
