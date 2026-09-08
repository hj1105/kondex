import {
  kontextRuntimeDoctorReportSchema,
  type KontextRuntimeInspection
} from '../../../../shared/kontext-runtime-contract'
import {
  KontextSidecarError,
  type KontextSidecarService
} from '../../../kontext/kontext-sidecar-service'
import { getKontextSidecarService } from '../../../kontext/kontext-sidecar-runtime'
import { defineMethod, type RpcMethod } from '../core'
import { createKontextScheduleMethods } from './kontext-schedule'
import { z } from 'zod'
import { kontextPlanningMethods } from './kontext-planning'
import { kontextCompletionMethod } from './kontext-completion'
import { kontextFinalizationMethods } from './kontext-finalization'
import { kontextTaskInventoryMethod } from './kontext-task-inventory'
import { kontextRegisteredScheduleMethods } from './kontext-registered-schedule'
import { kontextSessionSourceMethods } from './kontext-session-source'
import { kontextTaskInspectionSchema } from '../../../../shared/kontext-task-inspection-contract'
import { kontextOntologyMethods } from './kontext-ontology'
import {
  kontextRegisterMarkdownSourceMethod,
  kontextSourceManagementMethods
} from './kontext-source'

type RuntimeInspector = Pick<KontextSidecarService, 'inspectRuntimes'>

export async function inspectKontextRuntimes(
  sidecar: RuntimeInspector
): Promise<KontextRuntimeInspection> {
  try {
    const result = await sidecar.inspectRuntimes()
    const parsed = kontextRuntimeDoctorReportSchema.safeParse(result)
    if (!parsed.success) {
      return {
        status: 'unavailable',
        diagnostic: 'Kontext returned an invalid runtime capability report.'
      }
    }
    return { status: 'ready', report: parsed.data }
  } catch (error) {
    if (error instanceof KontextSidecarError) {
      return { status: error.code, diagnostic: error.message }
    }
    return {
      status: 'unavailable',
      diagnostic:
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'Kontext runtime inspection failed.'
    }
  }
}

export const KONTEXT_METHODS: RpcMethod[] = [
  ...kontextOntologyMethods,
  ...kontextRegisteredScheduleMethods,
  kontextTaskInventoryMethod,
  ...kontextSessionSourceMethods,
  ...kontextFinalizationMethods,
  kontextCompletionMethod,
  ...kontextPlanningMethods,
  kontextRegisterMarkdownSourceMethod,
  ...kontextSourceManagementMethods,
  defineMethod({
    name: 'kontext.inspectTask',
    params: z.object({ taskId: z.string().min(1) }),
    handler: async (request, { runtime, signal }) => {
      signal?.throwIfAborted()
      const response = await getKontextSidecarService(runtime.getRuntimeId()).callTool(
        'kontext_inspect_task',
        request
      )
      const result = kontextTaskInspectionSchema.parse(response)
      if (
        result.taskId !== request.taskId ||
        (result.contract && result.contract.taskId !== request.taskId)
      ) {
        throw new Error('Kontext returned a different task.')
      }
      return result
    }
  }),
  ...createKontextScheduleMethods(),
  defineMethod({
    name: 'kontext.inspectRuntimes',
    params: null,
    handler: (_request, { runtime }) =>
      inspectKontextRuntimes(getKontextSidecarService(runtime.getRuntimeId()))
  })
]
