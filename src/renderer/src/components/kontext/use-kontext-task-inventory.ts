import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import {
  kontextTaskInventorySchema,
  type KontextTaskInventory
} from '../../../../shared/kontext-task-inventory-contract'
import type { KontextRequestOwner } from './kontext-request-journal'
import { useKontextHostInventory } from './use-kontext-host-inventory'

export function useKontextTaskInventory(owner: KontextRequestOwner) {
  return useKontextHostInventory<KontextTaskInventory>(owner, async (previous) => {
    const result = kontextTaskInventorySchema.parse(
      await callRuntimeRpc<unknown>(
        owner,
        'kontext.listTasks',
        {
          limit: 50,
          ...(previous?.nextCursor ? { cursor: previous.nextCursor } : {})
        },
        {
          expectedEnvironmentPairingRevision:
            owner.kind === 'environment' ? owner.pairingRevision : undefined,
          timeoutMs: 60_000
        }
      )
    )
    const offset = previous?.nextCursor?.offset ?? 0
    if (
      result.tasks.length > 50 ||
      (result.nextCursor &&
        (result.tasks.length !== 50 || result.nextCursor.offset !== offset + 50)) ||
      (previous &&
        (result.organizationId !== previous.organizationId ||
          result.inventoryDigest !== previous.inventoryDigest ||
          result.tasks.some((row) => previous.tasks.some((old) => old.taskId === row.taskId))))
    ) {
      throw new Error('Task inventory changed')
    }
    return { ...result, tasks: [...(previous?.tasks ?? []), ...result.tasks] }
  })
}
