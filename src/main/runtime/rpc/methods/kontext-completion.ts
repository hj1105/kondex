import {
  kontextCompletionAssessmentSchema,
  kontextCompletionRequestSchema
} from '../../../../shared/kontext-completion-contract'
import { getKontextSidecarService } from '../../../kontext/kontext-sidecar-runtime'
import { defineMethod } from '../core'

export const kontextCompletionMethod = defineMethod({
  name: 'kontext.assessCompletion',
  params: kontextCompletionRequestSchema,
  handler: async (request, { runtime, signal }) => {
    signal?.throwIfAborted()
    const response = await getKontextSidecarService(runtime.getRuntimeId()).callTool(
      'kontext_assess_completion',
      request
    )
    signal?.throwIfAborted()
    const result = kontextCompletionAssessmentSchema.parse(response)
    if (result.taskId !== request.taskId || result.jobId !== request.jobId) {
      throw new Error('Kontext returned completion evidence for a different Task or schedule.')
    }
    return result
  }
})
