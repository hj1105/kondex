import { z } from 'zod'
import {
  kontextTaskInventoryRequestSchema,
  kontextTaskInventoryRowSchema
} from './kontext-task-inventory-contract'

const id = z.string().min(1)
const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/)
export const kontextScheduleHistoryRequestSchema = kontextTaskInventoryRequestSchema
  .pick({ limit: true, cursor: true })
  .extend({ taskId: id })
export const kontextScheduleHistorySchema = z
  .object({
    version: z.literal(1),
    taskId: id,
    organizationId: id,
    observation: z.literal('saved_metadata_only'),
    currentEvidence: z.literal('not_revalidated'),
    inventoryDigest: digest,
    schedules: z.array(kontextTaskInventoryRowSchema.shape.latestSchedule.unwrap()).max(100),
    nextCursor: kontextTaskInventoryRequestSchema.shape.cursor.unwrap().nullable()
  })
  .refine(
    (page) =>
      page.schedules.every((job) => job.taskId === page.taskId) &&
      new Set(page.schedules.map((job) => job.jobId)).size === page.schedules.length &&
      (!page.nextCursor ||
        (page.nextCursor.digest === page.inventoryDigest && page.schedules.length > 0))
  )
export type KontextScheduleHistory = z.infer<typeof kontextScheduleHistorySchema>

export function validateScheduleHistoryPage(
  page: KontextScheduleHistory,
  request: z.input<typeof kontextScheduleHistoryRequestSchema>
) {
  const limit = request.limit ?? 50
  if (
    page.taskId !== request.taskId ||
    page.schedules.length > limit ||
    (request.cursor && page.inventoryDigest !== request.cursor.digest) ||
    (page.nextCursor &&
      (page.schedules.length !== limit ||
        page.nextCursor.offset !== (request.cursor?.offset ?? 0) + limit))
  ) {
    throw new Error('Schedule history changed')
  }
}
