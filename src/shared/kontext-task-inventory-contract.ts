import { z } from 'zod'
const id = z.string().min(1)
const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/)
const timestamp = z.string().datetime({ offset: true })
const cursor = z.object({ digest, offset: z.number().int().positive() })
export const kontextTaskInventoryRequestSchema = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  workspaceId: id.optional(),
  cursor: cursor.optional()
})
export const kontextTaskInventoryRowSchema = z
  .object({
    taskId: id,
    intent: id,
    risk: z.enum(['low', 'medium', 'high']),
    workspaceId: id,
    workspacePath: id,
    createdAt: timestamp,
    contextDigest: id,
    scheduleCount: z.number().int().nonnegative(),
    unsettledScheduleCount: z.number().int().nonnegative(),
    latestSchedule: z
      .object({
        taskId: id,
        jobId: id,
        status: z.enum([
          'queued',
          'running',
          'cancelling',
          'completed',
          'failed',
          'interrupted',
          'cancelled'
        ]),
        codeRevision: id,
        contextDigest: id,
        requestedAt: timestamp
      })
      .nullable(),
    integration: z.object({ jobId: id, gitCommit: id, createdAt: timestamp }).nullable(),
    finalization: z
      .object({ recordId: digest, jobId: id, gitCommit: id, completedAt: timestamp })
      .nullable()
  })
  .refine(
    (row) =>
      row.unsettledScheduleCount <= row.scheduleCount &&
      ((row.scheduleCount === 0 && row.latestSchedule === null) ||
        (row.scheduleCount > 0 && row.latestSchedule?.taskId === row.taskId))
  )
export const kontextTaskInventorySchema = z
  .object({
    version: z.literal(1),
    organizationId: id,
    observation: z.literal('saved_metadata_only'),
    currentEvidence: z.literal('not_revalidated'),
    inventoryDigest: digest,
    nextCursor: cursor.nullable(),
    tasks: z.array(kontextTaskInventoryRowSchema).max(100)
  })
  .refine(
    (page) =>
      new Set(page.tasks.map((task) => task.taskId)).size === page.tasks.length &&
      (!page.nextCursor ||
        (page.nextCursor.digest === page.inventoryDigest && page.tasks.length > 0))
  )
export type KontextTaskInventory = z.infer<typeof kontextTaskInventorySchema>
export type KontextTaskInventoryRow = z.infer<typeof kontextTaskInventoryRowSchema>
