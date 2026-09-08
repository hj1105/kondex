import {
  kontextScheduleHistoryRequestSchema,
  kontextScheduleHistorySchema,
  validateScheduleHistoryPage
} from '../../../../shared/kontext-schedule-history-contract'
import { getKontextSidecarService } from '../../../kontext/kontext-sidecar-runtime'
import { defineMethod } from '../core'

export const kontextScheduleHistoryMethod = defineMethod({
  name: 'kontext.listRegisteredSchedules',
  params: kontextScheduleHistoryRequestSchema,
  handler: async (request, { runtime, signal }) => {
    signal?.throwIfAborted()
    const result = kontextScheduleHistorySchema.parse(
      await getKontextSidecarService(runtime.getRuntimeId()).callTool(
        'kontext_list_registered_schedules',
        request
      )
    )
    signal?.throwIfAborted()
    validateScheduleHistoryPage(result, request)
    return result
  }
})
