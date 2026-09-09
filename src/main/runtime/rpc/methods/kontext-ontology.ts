import type { z } from 'zod'
import {
  kontextOntologyAddRequestSchema,
  kontextOntologyAddResultSchema,
  kontextOntologyCheckResultSchema,
  kontextOntologyConfigRequestSchema,
  kontextOntologyFailureSchema,
  kontextOntologyImportRequestSchema,
  kontextOntologyImportResultSchema,
  kontextOntologyListResultSchema,
  kontextOntologySetupRequestSchema,
  kontextOntologySetupResultSchema
} from '../../../../shared/kontext-ontology-contract'
import { runKontextOntologyJson } from '../../../kontext/kontext-ontology-cli'
import { defineMethod, type RpcMethod } from '../core'

/**
 * Host-side ontology setup. These run the Kontext Brain CLI in the selected
 * workspace; none of them start an agent, register evidence, or approve
 * anything. Add, import and setup write only when the caller asks them to.
 */

type Runtime = { resolveKontextSourceWorkspace: (value: string) => Promise<string> }

async function run<Schema extends z.ZodTypeAny>(
  workspace: string,
  args: readonly string[],
  schema: Schema,
  runtime: Runtime,
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

export const kontextOntologyListSourcesMethod = defineMethod({
  name: 'kontext.listOntologySources',
  params: kontextOntologyConfigRequestSchema,
  handler: async ({ workspacePath }, { runtime, signal }) =>
    run(workspacePath, ['list'], kontextOntologyListResultSchema, runtime, signal)
})

export const kontextOntologyImportSourcesMethod = defineMethod({
  name: 'kontext.importOntologySources',
  params: kontextOntologyImportRequestSchema,
  handler: async ({ workspacePath, includeMarkdown, apply }, { runtime, signal }) => {
    const args = ['import-mcp', '--project', '.']
    if (includeMarkdown) {
      args.push('--markdown', '.')
    }
    if (apply) {
      args.push('--write')
    }
    return run(workspacePath, args, kontextOntologyImportResultSchema, runtime, signal)
  }
})

export const kontextOntologyAddSourceMethod = defineMethod({
  name: 'kontext.addOntologySource',
  params: kontextOntologyAddRequestSchema,
  handler: async (request, { runtime, signal }) => {
    const args = ['add', '--name', request.name, '--transport', request.transport]
    if (request.command) {
      args.push('--command', request.command)
    }
    for (const value of request.args ?? []) {
      // Why: a comma-joined list splits an argument that contains a comma and drops
      // empty ones, so the server would be started with the wrong argv.
      args.push('--arg', value)
    }
    if (request.url) {
      args.push('--url', request.url)
    }
    if (request.ref) {
      args.push('--ref', request.ref)
    }
    for (const [key, value] of Object.entries(request.env ?? {})) {
      // Why: one flag per variable keeps a value that contains '=' or ',' intact.
      args.push('--env', `${key}=${value}`)
    }
    if (request.path) {
      args.push('--path', request.path)
    }
    for (const value of request.include ?? []) {
      args.push('--include-dir', value)
    }
    if (request.type) {
      args.push('--type', request.type)
    }
    if (request.apply) {
      args.push('--write')
    }
    return run(request.workspacePath, args, kontextOntologyAddResultSchema, runtime, signal)
  }
})

export const kontextOntologyCheckSourcesMethod = defineMethod({
  name: 'kontext.checkOntologySources',
  params: kontextOntologyConfigRequestSchema,
  handler: async ({ workspacePath }, { runtime, signal }) =>
    run(workspacePath, ['check'], kontextOntologyCheckResultSchema, runtime, signal)
})

export const kontextOntologySetupMethod = defineMethod({
  name: 'kontext.setupOntology',
  params: kontextOntologySetupRequestSchema,
  handler: async ({ workspacePath, targetNodeCount, apply }, { runtime, signal }) => {
    const args = ['setup']
    if (targetNodeCount !== undefined) {
      args.push('--target-nodes', String(targetNodeCount))
    }
    if (apply) {
      args.push('--write')
    }
    return run(workspacePath, args, kontextOntologySetupResultSchema, runtime, signal)
  }
})

export const kontextOntologyMethods: RpcMethod[] = [
  kontextOntologyListSourcesMethod,
  kontextOntologyImportSourcesMethod,
  kontextOntologyAddSourceMethod,
  kontextOntologyCheckSourcesMethod,
  kontextOntologySetupMethod
]
