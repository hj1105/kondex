import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import {
  kontextScheduleHistorySchema,
  validateScheduleHistoryPage,
  type KontextScheduleHistory
} from '../../../../shared/kontext-schedule-history-contract'
import type { KontextRequestOwner } from './kontext-request-journal'
import { useKontextHostInventory } from './use-kontext-host-inventory'

export function useKontextScheduleHistory(owner: KontextRequestOwner, taskId: string) {
  return useKontextHostInventory<KontextScheduleHistory>(owner, async (previous) => {
    const request = {
      taskId,
      limit: 50,
      ...(previous?.nextCursor ? { cursor: previous.nextCursor } : {})
    }
    const result = kontextScheduleHistorySchema.parse(
      await callRuntimeRpc<unknown>(owner, 'kontext.listRegisteredSchedules', request, {
        expectedEnvironmentPairingRevision:
          owner.kind === 'environment' ? owner.pairingRevision : undefined,
        timeoutMs: 60_000
      })
    )
    validateScheduleHistoryPage(result, request)
    if (
      previous &&
      (result.organizationId !== previous.organizationId ||
        result.schedules.some((job) => previous.schedules.some((old) => old.jobId === job.jobId)))
    ) {
      throw new Error('Schedule history changed')
    }
    return { ...result, schedules: [...(previous?.schedules ?? []), ...result.schedules] }
  })
}
