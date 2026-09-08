import { z } from 'zod'
import { kontextSourceIdentitySchema } from './kontext-source-contract'
import { kontextTaskInspectionSchema } from './kontext-task-inspection-contract'

const id = z.string().min(1)
const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/)
export const kontextPlanSelectorSchema = z.object({ requestId: z.string().uuid() })
export const kontextPlanRequestSchema = kontextPlanSelectorSchema.extend({
  workspace: id.max(4096),
  goal: z.string().trim().min(1).max(32_768),
  provider: z.enum(['codex', 'claude']),
  sourceResourceIds: z.array(kontextSourceIdentitySchema.shape.resourceId).max(32)
})
export const kontextPlanApprovalSchema = kontextPlanSelectorSchema.extend({
  expectedPlanDigest: digest
})
const kontextPlanRefinementSchema = z.object({
  parentRequestId: z.string().uuid(),
  expectedParentDigest: digest,
  feedback: z.string().trim().min(1).max(8_192)
})
export const kontextPlanRefinementRequestSchema = kontextPlanRefinementSchema
  .extend(kontextPlanSelectorSchema.shape)
  .refine((request) => request.requestId !== request.parentRequestId)
export const kontextPlanViewSchema = z
  .object({
    request: kontextPlanRequestSchema
      .omit({ workspace: true })
      .extend({ workspacePath: id, workspaceId: id }),
    status: z.enum(['planning', 'review', 'failed', 'unverifiable', 'approved']),
    requestedAt: z.string().datetime(),
    refinement: kontextPlanRefinementSchema.optional(),
    codeRevision: id.optional(),
    contextDigest: digest.optional(),
    evidenceIds: z.array(id).optional(),
    planDigest: digest.optional(),
    taskId: id.optional(),
    diagnostic: id.optional(),
    proposal: z
      .object({
        contract: kontextTaskInspectionSchema.shape.contract.unwrap().omit({ taskId: true }),
        logicPlans: z
          .array(
            z.object({
              workItemId: id,
              plannedSymbolIds: z.array(id).min(1),
              allowedPaths: z.array(id).min(1),
              dependsOn: z.array(id).optional(),
              requiredVerifiers: z.array(z.object({ kind: id, ref: id })).optional(),
              plannedSymbols: z
                .array(
                  z.object({
                    plannedSymbolId: id,
                    responsibility: id,
                    intendedIdentity: z.object({
                      codebaseId: id.optional(),
                      relativePath: id,
                      language: id.optional(),
                      kind: id,
                      qualifiedName: id.optional(),
                      signatureDiscriminator: z.string().optional()
                    })
                  })
                )
                .min(1)
            })
          )
          .min(1)
      })
      .optional()
  })
  .superRefine((plan, ctx) => {
    if (
      ['review', 'approved'].includes(plan.status) &&
      (!plan.proposal || !plan.planDigest || !plan.codeRevision || !plan.contextDigest)
    ) {
      ctx.addIssue({ code: 'custom', message: 'Reviewed plan is incomplete' })
    }
    if (plan.status === 'approved' && !plan.taskId) {
      ctx.addIssue({ code: 'custom', message: 'Approved plan must identify its Task' })
    }
  })
export const kontextPlanStartedSchema = z.object({
  created: z.boolean(),
  plan: kontextPlanViewSchema
})
export const kontextPlanApprovedSchema = z
  .object({
    requestId: z.string().uuid(),
    planDigest: digest,
    created: z.boolean(),
    taskId: id,
    inspectionBasis: z.literal('stored_context'),
    inspection: kontextTaskInspectionSchema
  })
  .refine(
    (result) =>
      result.taskId === result.inspection.taskId &&
      result.taskId === result.inspection.contract?.taskId
  )
export type KontextPlanView = z.infer<typeof kontextPlanViewSchema>
export type KontextPlanRequest = z.infer<typeof kontextPlanRequestSchema>
export type KontextPlanRefinementRequest = z.infer<typeof kontextPlanRefinementRequestSchema>

export function confirmKontextPlanRefinement(
  plan: KontextPlanView,
  request: KontextPlanRefinementRequest
): void {
  if (
    plan.request.requestId !== request.requestId ||
    plan.refinement?.parentRequestId !== request.parentRequestId ||
    plan.refinement.expectedParentDigest !== request.expectedParentDigest ||
    plan.refinement.feedback !== request.feedback
  ) {
    throw new Error('Plan refinement was not confirmed; inspect its request ID before retrying.')
  }
}
