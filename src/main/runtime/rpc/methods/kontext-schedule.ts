import type { ZodType } from 'zod'
import {
  kontextIntegrationResultSchema,
  kontextIntegrateScheduleSchema,
  kontextRefreshScheduleSchema,
  kontextScheduleJobSchema,
  kontextScheduleJobSelectorSchema,
  kontextScheduleLogicSchema
} from '../../../../shared/kontext-schedule-contract'
import type {
  KontextSidecarService,
  KontextToolName
} from '../../../kontext/kontext-sidecar-service'
import { getKontextSidecarService } from '../../../kontext/kontext-sidecar-runtime'
import { defineMethod, type RpcMethod } from '../core'

type ScheduleSidecar = Pick<KontextSidecarService, 'callTool'>

export function createKontextScheduleMethods(
  sidecar: (runtimeId: string) => ScheduleSidecar = getKontextSidecarService
): RpcMethod[] {
  const schedule = defineMethod({
    name: 'kontext.scheduleLogic',
    params: kontextScheduleLogicSchema,
    handler: async ({ worktree, ...request }, { runtime, signal }) => {
      signal?.throwIfAborted()
      const repositoryPath = await runtime.resolveKontextScheduleRepository(worktree)
      signal?.throwIfAborted()
      const job = await callScheduleTool(
        sidecar(runtime.getRuntimeId()),
        'kontext_schedule_logic',
        { ...request, repositoryPath },
        kontextScheduleJobSchema
      )
      if (job.taskId !== request.taskId || job.repositoryPath !== repositoryPath) {
        throw new Error(
          'Kontext returned a schedule for a different task or repository; execution outcome is unknown. Do not enqueue again automatically.'
        )
      }
      if (request.requestId && job.requestId !== request.requestId) {
        throw new Error(
          'Kontext did not confirm the schedule request identity; execution outcome is unknown. Do not retry automatically.'
        )
      }
      return job
    }
  })
  return [
    schedule,
    {
      ...schedule,
      name: 'kontext.enqueueSchedule',
      params: kontextScheduleLogicSchema.required({ requestId: true })
    },
    defineMethod({
      name: 'kontext.refreshSchedule',
      params: kontextRefreshScheduleSchema,
      handler: async ({ jobId }, { runtime, signal }) => {
        signal?.throwIfAborted()
        const job = await callScheduleTool(
          sidecar(runtime.getRuntimeId()),
          'kontext_get_schedule',
          { jobId },
          kontextScheduleJobSchema
        )
        assertJobIdentity(job.jobId, jobId)
        return job
      }
    }),
    defineMethod({
      name: 'kontext.cancelSchedule',
      params: kontextScheduleJobSelectorSchema,
      handler: async ({ jobId }, { runtime, signal }) => {
        signal?.throwIfAborted()
        const job = await callScheduleTool(
          sidecar(runtime.getRuntimeId()),
          'kontext_cancel_schedule',
          { jobId },
          kontextScheduleJobSchema
        )
        assertJobIdentity(job.jobId, jobId)
        return job
      }
    }),
    defineMethod({
      name: 'kontext.integrateSchedule',
      params: kontextIntegrateScheduleSchema,
      handler: async (request, { runtime, signal }) => {
        signal?.throwIfAborted()
        const result = await callScheduleTool(
          sidecar(runtime.getRuntimeId()),
          'kontext_integrate_schedule',
          request,
          kontextIntegrationResultSchema
        )
        assertJobIdentity(result.state.scheduleJobId, request.jobId)
        return result
      }
    })
  ]
}

async function callScheduleTool<T>(
  sidecar: ScheduleSidecar,
  name: KontextToolName,
  request: Record<string, unknown>,
  schema: ZodType<T>
): Promise<T> {
  // Do not retry: a lost response does not prove the mutation was not accepted.
  let result: unknown
  try {
    result = await sidecar.callTool(name, request)
  } catch (cause) {
    throw new Error(
      `Kontext could not confirm ${name}; execution outcome is unknown. Do not retry automatically.`,
      { cause }
    )
  }
  const parsed = schema.safeParse(result)
  if (!parsed.success) {
    throw new Error(
      `Kontext returned an invalid ${name} response; execution outcome is unknown. Do not retry automatically.`
    )
  }
  return parsed.data
}

function assertJobIdentity(actual: string, expected: string): void {
  if (actual !== expected) {
    throw new Error('Kontext returned a different schedule; execution outcome is unknown.')
  }
}
