import {
  kontextFinalizationRequestSchema,
  kontextFinalizationResultSchema,
  kontextFinalizationInspectionRequestSchema,
  kontextFinalizationInspectionSchema,
  kontextFinalizationRevalidationRequestSchema,
  kontextFinalizationRevalidationSchema
} from '../../../../shared/kontext-finalization-contract'
import { getKontextSidecarService } from '../../../kontext/kontext-sidecar-runtime'
import { defineMethod } from '../core'

export const kontextFinalizationMethods = [
  defineMethod({
    name: 'kontext.revalidateFinalization',
    params: kontextFinalizationRevalidationRequestSchema,
    handler: async (request, { runtime, signal }) => {
      signal?.throwIfAborted()
      const result = kontextFinalizationRevalidationSchema.parse(
        await getKontextSidecarService(runtime.getRuntimeId()).callTool(
          'kontext_revalidate_finalization',
          request
        )
      )
      signal?.throwIfAborted()
      if (result.taskId !== request.taskId || result.recordId !== request.expectedRecordId) {
        throw new Error('Kontext revalidated a different Task or finalization record.')
      }
      return result
    }
  }),
  defineMethod({
    name: 'kontext.finalizeTask',
    params: kontextFinalizationRequestSchema,
    handler: async (request, { runtime, signal }) => {
      signal?.throwIfAborted()
      const result = kontextFinalizationResultSchema.parse(
        await getKontextSidecarService(runtime.getRuntimeId()).callTool(
          'kontext_finalize_task',
          request
        )
      )
      signal?.throwIfAborted()
      if (JSON.stringify(result.record.request) !== JSON.stringify(request)) {
        throw new Error(
          'Kontext returned a different finalization request. Read the original request before retrying.'
        )
      }
      return result
    }
  }),
  defineMethod({
    name: 'kontext.inspectFinalization',
    params: kontextFinalizationInspectionRequestSchema,
    handler: async (request, { runtime, signal }) => {
      signal?.throwIfAborted()
      const result = kontextFinalizationInspectionSchema.parse(
        await getKontextSidecarService(runtime.getRuntimeId()).callTool(
          'kontext_inspect_finalization',
          request
        )
      )
      signal?.throwIfAborted()
      if (
        result.taskId !== request.taskId ||
        (result.record &&
          (result.record.request.taskId !== request.taskId ||
            (request.requestId && result.record.request.requestId !== request.requestId)))
      ) {
        throw new Error('Kontext returned finalization history for a different Task or request.')
      }
      return result
    }
  })
]
