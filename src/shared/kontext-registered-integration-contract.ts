import { z } from 'zod'
import {
  kontextIntegrationResultSchema,
  kontextScheduleJobSchema
} from './kontext-schedule-contract'
import { kontextRegisteredScheduleControlSchema } from './kontext-registered-schedule-contract'

const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/)
export const kontextRegisteredIntegrationRequestSchema =
  kontextRegisteredScheduleControlSchema.extend({
    expectedIntegrationDigest: digest.nullable(),
    allowSubscriptionExecution: z.literal(true)
  })
export const kontextRegisteredIntegrationSchema = z
  .object({
    version: z.literal(1),
    taskId: z.string().min(1),
    jobId: z.string().min(1),
    jobIdentityDigest: digest,
    observation: z.literal('saved_metadata_only'),
    currentEvidence: z.literal('not_revalidated'),
    scheduleStatus: kontextScheduleJobSchema.shape.status,
    canRequestIntegration: z.boolean(),
    integrationDigest: digest.nullable(),
    integration: kontextIntegrationResultSchema.shape.state.nullable(),
    command: z.literal('integrate').optional()
  })
  .refine(
    (value) =>
      (value.integration === null) === (value.integrationDigest === null) &&
      (!value.integration || value.integration.taskId === value.taskId) &&
      (!value.canRequestIntegration || value.scheduleStatus === 'completed') &&
      (!value.command ||
        (value.integration?.scheduleJobId === value.jobId && value.canRequestIntegration))
  )
export type KontextRegisteredIntegration = z.infer<typeof kontextRegisteredIntegrationSchema>
