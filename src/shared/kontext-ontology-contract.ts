import { z } from 'zod'

/**
 * Ontology setup runs in Kontext Brain, not in the Task sidecar Kondex speaks to.
 * The sidecar bundle is built from the Task tool server and carries no ontology
 * capability, so the host drives the `kontext-ontology` CLI from the same
 * checkout. The CLI answers in JSON so this surface can show per-source state
 * instead of a terminal transcript.
 */

export const KONTEXT_SOURCE_TRANSPORTS = ['stdio', 'sse', 'local', 'git'] as const
/** Layer adapters Kontext Brain can apply to a source's documents. */
export const KONTEXT_SOURCE_TYPES = ['notion', 'jira', 'github_pr', 'slack'] as const

export const kontextSourceTransportSchema = z.enum(KONTEXT_SOURCE_TRANSPORTS)

export const kontextOntologySourceSchema = z.object({
  name: z.string(),
  transport: kontextSourceTransportSchema,
  type: z.string().nullable(),
  target: z.string(),
  /** local/git: source files are read as well as Markdown. */
  code: z.boolean().optional()
})

export const kontextOntologyConfigRequestSchema = z.object({
  /** Workspace selector; its directory holds kontext.yaml. */
  workspacePath: z.string().min(1)
})

export const kontextOntologyListResultSchema = z.object({
  command: z.literal('list'),
  ok: z.literal(true),
  sources: z.array(kontextOntologySourceSchema)
})

export const kontextOntologyImportRequestSchema = kontextOntologyConfigRequestSchema.extend({
  includeMarkdown: z.boolean().default(false),
  apply: z.boolean().default(false)
})

export const kontextOntologyImportResultSchema = z.object({
  command: z.literal('import-mcp'),
  ok: z.literal(true),
  discovered: z.array(
    kontextOntologySourceSchema.extend({
      origin: z.string(),
      scope: z.string().nullable(),
      alreadyPresent: z.boolean()
    })
  ),
  added: z.array(z.string()),
  written: z.boolean()
})

export const kontextOntologyAddRequestSchema = kontextOntologyConfigRequestSchema
  .extend({
    name: z.string().min(1),
    transport: kontextSourceTransportSchema,
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    /** sse: the server URL; git: the repository to clone. */
    url: z.string().optional(),
    /** git: branch or tag to read; the remote default when omitted. */
    ref: z.string().optional(),
    /** stdio: environment the server needs, such as an API token. */
    env: z.record(z.string(), z.string()).optional(),
    /** Workspace-relative or absolute directory for a local source. */
    path: z.string().optional(),
    include: z.array(z.string()).optional(),
    type: z.enum(KONTEXT_SOURCE_TYPES).optional(),
    /** local/git: also read source files through the code providers. */
    code: z.boolean().optional(),
    apply: z.boolean().default(false)
  })
  .superRefine((value, context) => {
    // Why: the CLI would reject these too, but failing here keeps the surface from
    // spawning a process only to report a field the form could have caught.
    const required =
      value.transport === 'stdio'
        ? 'command'
        : value.transport === 'sse' || value.transport === 'git'
          ? 'url'
          : 'path'
    if (!value[required]?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [required],
        message: `A ${value.transport} source needs ${required}.`
      })
    }
  })

export const kontextOntologyAddResultSchema = z.object({
  command: z.literal('add'),
  ok: z.literal(true),
  name: z.string(),
  written: z.boolean()
})

export const kontextOntologyRepositoriesRequestSchema = kontextOntologyConfigRequestSchema.extend({
  /** Organization or user, as a name or a github.com URL. */
  owner: z.string().trim().min(1)
})

export const kontextGithubRepositorySchema = z.object({
  name: z.string(),
  fullName: z.string(),
  url: z.string(),
  cloneUrl: z.string(),
  defaultBranch: z.string(),
  private: z.boolean(),
  archived: z.boolean(),
  fork: z.boolean(),
  language: z.string().nullable(),
  description: z.string().nullable(),
  pushedAt: z.string().nullable()
})

export const kontextOntologyRepositoriesResultSchema = z.object({
  command: z.literal('github-repos'),
  ok: z.literal(true),
  owner: z.string(),
  kind: z.enum(['organization', 'user']),
  repositories: z.array(kontextGithubRepositorySchema)
})

export const kontextOntologyCheckResultSchema = z.object({
  command: z.literal('check'),
  ok: z.boolean(),
  sources: z.array(
    z.object({
      name: z.string(),
      ok: z.boolean(),
      resourceCount: z.number().nullable(),
      error: z.string().nullable()
    })
  )
})

export const kontextOntologySetupRequestSchema = kontextOntologyConfigRequestSchema.extend({
  targetNodeCount: z.number().int().min(3).max(200).optional(),
  apply: z.boolean().default(false)
})

export const kontextOntologySetupResultSchema = z.object({
  command: z.literal('setup'),
  ok: z.literal(true),
  nodesCreated: z.number(),
  nodesReused: z.number(),
  documentsClassified: z.number(),
  documentsUnmapped: z.number(),
  nodeIds: z.array(z.string()),
  written: z.boolean()
})

export const kontextOntologyFailureSchema = z.object({
  command: z.string(),
  ok: z.literal(false),
  error: z.string()
})

export type KontextOntologySource = z.infer<typeof kontextOntologySourceSchema>
export type KontextOntologyListResult = z.infer<typeof kontextOntologyListResultSchema>
export type KontextOntologyImportResult = z.infer<typeof kontextOntologyImportResultSchema>
export type KontextOntologyAddResult = z.infer<typeof kontextOntologyAddResultSchema>
export type KontextOntologyCheckResult = z.infer<typeof kontextOntologyCheckResultSchema>
export type KontextOntologySetupResult = z.infer<typeof kontextOntologySetupResultSchema>
export type KontextOntologyAddRequest = z.infer<typeof kontextOntologyAddRequestSchema>
export type KontextGithubRepository = z.infer<typeof kontextGithubRepositorySchema>
export type KontextOntologyRepositoriesResult = z.infer<
  typeof kontextOntologyRepositoriesResultSchema
>
