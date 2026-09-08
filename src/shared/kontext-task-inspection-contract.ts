import { z } from 'zod'

const id = z.string().min(1)
export const kontextTaskInspectionSchema = z.object({
  taskId: id,
  status: z.enum(['unprepared', 'current', 'stale', 'conflict', 'inaccessible', 'unavailable']),
  contract: z
    .object({
      taskId: id,
      intent: id,
      risk: z.enum(['low', 'medium', 'high']),
      acceptance: z
        .array(
          z.object({ criterionId: id, statement: id, verifier: z.object({ kind: id, ref: id }) })
        )
        .min(1),
      nonGoals: z.array(z.string()),
      targets: z.array(id).min(1)
    })
    .nullable(),
  codeRevision: id,
  contextDigest: id.nullable(),
  requiredEvidenceIds: z.array(id),
  normativeRevisionCount: z.number().int().nonnegative(),
  conflictCount: z.number().int().nonnegative(),
  logic: z.array(
    z.object({
      workItemId: id,
      plannedSymbolIds: z.array(id).min(1),
      allowedPaths: z.array(id).min(1),
      dependsOn: z.array(id)
    })
  )
})
export type KontextTaskInspection = z.infer<typeof kontextTaskInspectionSchema>
