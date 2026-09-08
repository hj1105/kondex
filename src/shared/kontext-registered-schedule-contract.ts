import { z } from 'zod'
import { kontextScheduleJobSchema } from './kontext-schedule-contract'

const id = z.string().min(1)
const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/)
const provider = z.enum(['codex', 'claude'])
export const kontextRegisteredScheduleSelectorSchema = z.object({ taskId: id, jobId: id })
export const kontextRegisteredScheduleControlSchema =
  kontextRegisteredScheduleSelectorSchema.extend({ expectedJobIdentityDigest: digest })
export const kontextRegisteredScheduleResumeSchema = kontextRegisteredScheduleControlSchema.extend({
  allowSubscriptionExecution: z.literal(true)
})

export const kontextRegisteredScheduleSchema = z
  .object({
    version: z.literal(1),
    observation: z.literal('saved_metadata_only'),
    currentEvidence: z.literal('not_revalidated'),
    jobIdentityDigest: digest,
    job: kontextScheduleJobSchema.pick({
      jobId: true,
      taskId: true,
      codeRevision: true,
      contextDigest: true,
      repositoryPath: true,
      status: true,
      requestedAt: true,
      startedAt: true,
      finishedAt: true,
      cancellationRequestedAt: true,
      resumeCount: true,
      lastResumedAt: true
    }),
    diagnosticPresent: z.boolean(),
    workItems: z
      .array(
        z
          .object({
            workItemId: id,
            eligibleProviders: z.array(provider).min(1),
            pinnedProvider: provider.optional(),
            result: z
              .object({
                workItemId: id,
                status: z.enum(['completed', 'failed']),
                attempts: z.number().int().nonnegative(),
                provider: provider.optional(),
                changeBundleId: id.optional(),
                settlementProofId: id.optional()
              })
              .nullable()
          })
          .refine(
            (work) =>
              (!work.pinnedProvider || work.eligibleProviders.includes(work.pinnedProvider)) &&
              (!work.result ||
                (work.result.workItemId === work.workItemId &&
                  (!work.result.provider || work.eligibleProviders.includes(work.result.provider))))
          )
      )
      .min(1),
    command: z
      .object({ action: z.enum(['resume', 'cancel']), resumeBlocked: z.boolean().optional() })
      .optional()
  })
  .refine(
    (result) =>
      new Set(result.workItems.map((work) => work.workItemId)).size === result.workItems.length &&
      (!result.command ||
        (result.command.action === 'resume'
          ? result.command.resumeBlocked !== undefined
          : result.command.resumeBlocked === undefined))
  )
export type KontextRegisteredSchedule = z.infer<typeof kontextRegisteredScheduleSchema>
