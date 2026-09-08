import { z } from 'zod'
import { kontextAccuracyManifestSchema } from './kontext-completion-contract'

const id = z.string().min(1)
const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/)
export const kontextFinalizationRequestSchema = z.object({
  taskId: id,
  jobId: id,
  requestId: z.string().uuid(),
  expectedCompletionBasisDigest: digest
})
export type KontextFinalizationRequest = z.infer<typeof kontextFinalizationRequestSchema>
export const kontextFinalizationRecordSchema = z
  .object({
    schemaVersion: z.literal(1),
    recordId: digest,
    organizationId: id,
    subjectId: id,
    request: kontextFinalizationRequestSchema,
    codeRevision: id,
    contextDigest: id,
    gitCommit: id,
    accuracyManifestId: id,
    accuracyManifest: kontextAccuracyManifestSchema,
    verificationRunIds: z.array(id),
    completedAt: z.string().datetime({ offset: true })
  })
  .refine(
    (record) =>
      record.accuracyManifestId === record.accuracyManifest.manifestId &&
      record.request.taskId === record.accuracyManifest.taskId &&
      record.codeRevision === record.accuracyManifest.resultCodeRevision &&
      record.contextDigest === record.accuracyManifest.contextDigest &&
      JSON.stringify(record.verificationRunIds) ===
        JSON.stringify(record.accuracyManifest.verificationRunIds)
  )
export type KontextFinalizationRecord = z.infer<typeof kontextFinalizationRecordSchema>
export const kontextFinalizationResultSchema = z
  .object({
    created: z.boolean(),
    record: kontextFinalizationRecordSchema,
    currentEvidence: z.enum(['validated_at_recording', 'not_revalidated'])
  })
  .refine((result) => result.created === (result.currentEvidence === 'validated_at_recording'))
export const kontextFinalizationInspectionRequestSchema = z.object({
  taskId: id,
  requestId: z.string().uuid().optional()
})
export const kontextFinalizationInspectionSchema = z.object({
  taskId: id,
  record: kontextFinalizationRecordSchema.nullable(),
  currentEvidence: z.literal('not_revalidated')
})

export const kontextFinalizationRevalidationRequestSchema = z.object({
  taskId: id,
  expectedRecordId: digest
})
export const kontextFinalizationRevalidationSchema = z
  .object({
    taskId: id,
    recordId: digest,
    currentEvidence: z.enum(['revalidated_current', 'changed']),
    recordedCompletionBasisDigest: digest,
    observedCompletionBasisDigest: digest,
    observedAt: z.string().datetime({ offset: true }),
    state: z.enum(['planned', 'in_progress', 'awaiting_evidence', 'blocked', 'done']),
    issueCount: z.number().int().nonnegative(),
    codeRevision: id,
    contextDigest: id,
    contextStatus: z.enum(['current', 'stale', 'conflict', 'inaccessible', 'unavailable'])
  })
  .refine(
    (result) =>
      result.currentEvidence !== 'revalidated_current' ||
      (result.recordedCompletionBasisDigest === result.observedCompletionBasisDigest &&
        result.state === 'done' &&
        result.issueCount === 0 &&
        result.contextStatus === 'current')
  )
