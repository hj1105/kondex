import { z } from 'zod'

const id = z.string().trim().min(1)
const timestamp = z.string().datetime({ offset: true })
export const kontextCompletionRequestSchema = z.object({ taskId: id, jobId: id })
export const kontextAccuracyManifestSchema = z.object({
  manifestId: id,
  taskId: id,
  taskContractDigest: id,
  contextDigest: id,
  baseCodeRevision: id,
  resultCodeRevision: id,
  normativeRevisions: z.array(z.object({ kind: id, recordId: id, revisionId: id })),
  evidenceIds: z.array(id),
  workItemIds: z.array(id),
  changeBundleIds: z.array(id),
  changedSymbolIds: z.array(id),
  verificationRunIds: z.array(id),
  reviewFindingIds: z.array(id),
  emergencyBypassIds: z.array(id),
  createdAt: timestamp
})
export const kontextCompletionAssessmentSchema = z
  .object({
    taskId: id,
    jobId: id,
    completionBasisDigest: z
      .string()
      .regex(/^sha256:[a-f0-9]{64}$/)
      .optional(),
    observedAt: timestamp,
    risk: z.enum(['low', 'medium', 'high']),
    state: z.enum(['planned', 'in_progress', 'awaiting_evidence', 'blocked', 'done']),
    issues: z.array(z.object({ code: id, message: id, ref: id.optional() })),
    context: z.object({
      status: z.enum(['current', 'stale', 'conflict', 'inaccessible', 'unavailable']),
      contextDigest: id
    }),
    gitCommit: id,
    codeRevision: id,
    workspacePath: id,
    invariantEvaluations: z.array(
      z.object({
        invariantId: id,
        revisionId: id,
        status: z.enum(['guarded', 'unguarded', 'violated', 'inconclusive', 'retired']),
        verificationRunIds: z.array(id)
      })
    ),
    verificationRuns: z.array(
      z.object({
        verificationRunId: id,
        tier: z.enum(['fast', 'targeted', 'full']),
        verifierKind: id,
        verifierRef: id,
        result: z.enum(['passed', 'failed', 'inconclusive']),
        observedAt: timestamp
      })
    ),
    accuracyManifest: kontextAccuracyManifestSchema.optional(),
    accuracyManifestError: z.string().optional()
  })
  .superRefine((result, context) => {
    const manifest = result.accuracyManifest
    if (
      manifest &&
      (manifest.taskId !== result.taskId ||
        manifest.contextDigest !== result.context.contextDigest ||
        manifest.resultCodeRevision !== result.codeRevision)
    ) {
      context.addIssue({ code: 'custom', message: 'Completion manifest identity mismatch' })
    }
    if (
      result.state === 'done' &&
      (!manifest ||
        result.issues.length ||
        result.context.status !== 'current' ||
        result.accuracyManifestError)
    ) {
      context.addIssue({ code: 'custom', message: 'Inconsistent completion verdict' })
    }
  })
export type KontextCompletionAssessment = z.infer<typeof kontextCompletionAssessmentSchema>
