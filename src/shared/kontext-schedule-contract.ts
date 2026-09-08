import { z } from 'zod'
import { kontextRuntimeProviderSchema } from './kontext-runtime-contract'

const id = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0)
const timestamp = z.string().datetime({ offset: true })

export const kontextScheduleLogicSchema = z.object({
  requestId: z.string().uuid().optional(),
  worktree: id,
  taskId: id,
  work: z
    .array(
      z.object({
        workItemId: id,
        prompt: z.string().min(1),
        eligibleProviders: z.array(kontextRuntimeProviderSchema).min(1),
        pinnedProvider: kontextRuntimeProviderSchema.optional(),
        totalTokenBudget: z.number().int().positive().optional(),
        optionalEvidenceTokenBudget: z.number().int().nonnegative().optional(),
        receiptTtlSeconds: z.number().int().min(60).max(3600).optional()
      })
    )
    .min(1),
  maxConcurrency: z.number().int().min(1).max(4).optional(),
  maxRetries: z.number().int().min(0).max(2).optional()
})

export const kontextScheduleJobSelectorSchema = z.object({ jobId: id })

// The sidecar's get operation may restart approved workers after revalidation.
export const kontextRefreshScheduleSchema = kontextScheduleJobSelectorSchema.extend({
  allowAutomaticResume: z.literal(true)
})

export const kontextIntegrateScheduleSchema = kontextScheduleJobSelectorSchema.extend({
  observedAt: z.string().datetime(),
  nextAttemptAt: z.string().datetime()
})

const workResultSchema = z.object({
  workItemId: id,
  status: z.enum(['completed', 'failed']),
  provider: kontextRuntimeProviderSchema.optional(),
  worktree: z
    .object({
      worktreeId: id,
      workspacePath: id,
      branchName: id,
      baseRevision: id
    })
    .optional(),
  checkpoints: z
    .array(
      z.object({
        checkpointId: id,
        taskId: id,
        workItemId: id,
        provider: kontextRuntimeProviderSchema,
        providerSessionId: id.optional(),
        workspacePath: id,
        codeRevision: id,
        contextDigest: id,
        createdAt: timestamp
      })
    )
    .optional(),
  attempts: z.number().int().nonnegative(),
  diagnostics: z.array(z.string()),
  settlementProofId: id.optional(),
  changeBundleId: id.optional(),
  targetedVerificationRunIds: z.array(id).optional()
})

const scheduleResultSchema = z.object({ results: z.array(workResultSchema) })

// Additive sidecar fields are ignored; execution completion is not Task completion.
export const kontextScheduleJobSchema = z.object({
  requestId: z.string().uuid().optional(),
  jobId: id,
  taskId: id,
  codeRevision: id,
  contextDigest: id,
  repositoryPath: id,
  status: z.enum([
    'queued',
    'running',
    'cancelling',
    'completed',
    'failed',
    'interrupted',
    'cancelled'
  ]),
  requestedAt: timestamp,
  cancellationRequestedAt: timestamp.optional(),
  startedAt: timestamp.optional(),
  finishedAt: timestamp.optional(),
  resumeCount: z.number().int().nonnegative(),
  lastResumedAt: timestamp.optional(),
  progress: scheduleResultSchema.optional(),
  result: scheduleResultSchema.optional(),
  diagnostic: z.string().optional(),
  resumeBlocked: z.boolean().optional(),
  resumeDiagnostic: z.string().optional()
})

export type KontextScheduleJob = z.infer<typeof kontextScheduleJobSchema>
export type KontextScheduleLogicRequest = z.infer<typeof kontextScheduleLogicSchema>

export const kontextIntegrationResultSchema = z.object({
  state: z.object({
    taskId: id,
    scheduleJobId: id,
    repositoryPath: id,
    workspacePath: id,
    baseRevision: id,
    gitCommit: id,
    resultRevision: id,
    contextDigest: id,
    changeBundleIds: z.array(id).min(1),
    workItemIds: z.array(id).min(1),
    changedPaths: z.array(id).min(1),
    changedSymbolIds: z.array(id).min(1),
    authorProviders: z.array(kontextRuntimeProviderSchema).min(1),
    createdAt: timestamp
  }),
  // Verification and review remain sidecar evidence, not a synthesized success verdict.
  executions: z.array(z.record(z.string(), z.unknown())),
  review: z.record(z.string(), z.unknown()).optional(),
  reviewFindings: z.array(z.record(z.string(), z.unknown())).optional(),
  reused: z.boolean().optional()
})
