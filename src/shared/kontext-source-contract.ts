import { z } from 'zod'
import { kontextSessionSourcePayloadSchema } from './kontext-session-source-contract'

export const kontextMarkdownSourceRequestSchema = z.object({
  workspace: z.string().min(1).max(4096),
  relativePath: z
    .string()
    .min(1)
    .max(4096)
    .refine((value) => {
      const parts = value.replaceAll('\\', '/').split('/')
      return (
        /\.(md|markdown)$/i.test(value) &&
        !Array.from(value).some((char) => char.charCodeAt(0) < 32 || char === ':') &&
        parts.every((part) => part.length > 0 && part !== '.' && part !== '..')
      )
    }, 'Select a workspace-relative Markdown file')
})

const id = z.string().min(1)
export const kontextMarkdownSourceResultSchema = z
  .object({
    organizationId: z.string().uuid(),
    resourceId: id,
    title: id,
    contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    changed: z.boolean(),
    evidence: z.array(z.object({ resourceId: id, evidenceId: id, chunkId: id })).max(256),
    providerSharing: z.literal('not_granted'),
    normativeApproval: z.literal('not_granted')
  })
  .refine(
    (result) => result.evidence.every((item) => item.resourceId === result.resourceId),
    'Kontext returned evidence for a different source'
  )

export type KontextMarkdownSourceResult = z.infer<typeof kontextMarkdownSourceResultSchema>

export const kontextSourceIdentitySchema = z.object({ resourceId: id.max(65_536) })
const provider = z.enum(['codex', 'claude'])
const classification = z.enum(['public', 'internal', 'confidential', 'restricted'])
export const kontextSourceSharingRequestSchema = z.object({
  resourceId: kontextSourceIdentitySchema.shape.resourceId,
  expectedRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  expectedContentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  dataClassification: classification,
  allowedRuntimeProviders: z.array(provider).max(2)
})
const markdownSourceInspectionSchema = z.object({
  organizationId: z.string().uuid(),
  resourceId: id,
  title: id,
  workspacePath: id,
  relativePath: id,
  contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  revision: z.number().int().positive(),
  status: z.enum(['active', 'stale']),
  sharing: z
    .object({
      dataClassification: classification,
      allowedRuntimeProviders: z.array(provider).max(2)
    })
    .nullable(),
  normativeApproval: z.literal('not_granted')
})
export const kontextSourceInspectionSchema = z.union([
  markdownSourceInspectionSchema,
  markdownSourceInspectionSchema.omit({ workspacePath: true, relativePath: true }).extend({
    sourceKind: z.literal('native_session'),
    nativeSession: kontextSessionSourcePayloadSchema.shape.origin
  })
])
export type KontextSourceInspection = z.infer<typeof kontextSourceInspectionSchema>

const inventoryCursor = z.object({
  digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  offset: z.number().int().min(1).max(10_000)
})
export const kontextSourceInventoryRequestSchema = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  includeNativeSessions: z.boolean().optional(),
  cursor: inventoryCursor.optional()
})
export const kontextSourceInventorySchema = z
  .object({
    organizationId: z.string().uuid(),
    sources: z.array(kontextSourceInspectionSchema).max(100),
    inventoryDigest: inventoryCursor.shape.digest,
    nextCursor: inventoryCursor.nullable(),
    observation: z.literal('saved_metadata_only'),
    nativeSessionsIncluded: z.boolean().optional()
  })
  .refine(
    (result) =>
      result.sources.every((source) => source.organizationId === result.organizationId) &&
      new Set(result.sources.map((source) => source.resourceId)).size === result.sources.length &&
      (!result.nextCursor || result.nextCursor.digest === result.inventoryDigest),
    'Source inventory identity mismatch'
  )
export type KontextSourceInventory = z.infer<typeof kontextSourceInventorySchema>
