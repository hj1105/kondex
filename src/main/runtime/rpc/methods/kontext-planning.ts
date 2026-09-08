import { realpath } from 'node:fs/promises'
import {
  confirmKontextPlanRefinement,
  kontextPlanRefinementRequestSchema,
  kontextPlanApprovalSchema,
  kontextPlanApprovedSchema,
  kontextPlanRequestSchema,
  kontextPlanSelectorSchema,
  kontextPlanStartedSchema,
  kontextPlanViewSchema
} from '../../../../shared/kontext-planning-contract'
import { getKontextSidecarService } from '../../../kontext/kontext-sidecar-runtime'
import { defineMethod, type RpcMethod } from '../core'

export const kontextPlanningMethods: RpcMethod[] = [
  defineMethod({
    name: 'kontext.refinePlan',
    params: kontextPlanRefinementRequestSchema,
    handler: async (request, { runtime, signal }) => {
      signal?.throwIfAborted()
      const result = kontextPlanStartedSchema.parse(
        await getKontextSidecarService(runtime.getRuntimeId()).callTool(
          'kontext_refine_plan',
          request
        )
      )
      confirmKontextPlanRefinement(result.plan, request)
      return result
    }
  }),
  defineMethod({
    name: 'kontext.startPlan',
    params: kontextPlanRequestSchema,
    handler: async ({ workspace, ...request }, { runtime, signal }) => {
      signal?.throwIfAborted()
      // The resolver refuses direct SSH/WSL; paired runtimes resolve on their own execution host.
      const workspacePath = await realpath(await runtime.resolveKontextSourceWorkspace(workspace))
      signal?.throwIfAborted()
      const result = kontextPlanStartedSchema.parse(
        await getKontextSidecarService(runtime.getRuntimeId()).callTool('kontext_start_plan', {
          ...request,
          workspacePath,
          workspaceId: `workspace:${workspacePath}`
        })
      )
      if (
        result.plan.request.requestId !== request.requestId ||
        result.plan.request.workspacePath !== workspacePath ||
        result.plan.request.goal !== request.goal ||
        result.plan.request.provider !== request.provider ||
        JSON.stringify(result.plan.request.sourceResourceIds) !==
          JSON.stringify(request.sourceResourceIds)
      ) {
        throw new Error('Plan request was not confirmed; inspect its request ID before retrying.')
      }
      return result
    }
  }),
  ...(['inspect', 'cancel'] as const).map((action) =>
    defineMethod({
      name: `kontext.${action}Plan`,
      params: kontextPlanSelectorSchema,
      handler: async (request, { runtime, signal }) => {
        signal?.throwIfAborted()
        const plan = kontextPlanViewSchema.parse(
          await getKontextSidecarService(runtime.getRuntimeId()).callTool(
            `kontext_${action}_plan`,
            request
          )
        )
        if (plan.request.requestId !== request.requestId) {
          throw new Error('Kontext returned a different plan.')
        }
        return plan
      }
    })
  ),
  defineMethod({
    name: 'kontext.approvePlan',
    params: kontextPlanApprovalSchema,
    handler: async (request, { runtime, signal }) => {
      signal?.throwIfAborted()
      const result = kontextPlanApprovedSchema.parse(
        await getKontextSidecarService(runtime.getRuntimeId()).callTool(
          'kontext_approve_plan',
          request
        )
      )
      if (
        result.requestId !== request.requestId ||
        result.planDigest !== request.expectedPlanDigest
      ) {
        throw new Error('Task approval was not confirmed; inspect the plan before retrying.')
      }
      return result
    }
  })
]
