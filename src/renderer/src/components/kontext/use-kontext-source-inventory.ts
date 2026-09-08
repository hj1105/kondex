import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import {
  kontextSourceInventorySchema,
  type KontextSourceInventory
} from '../../../../shared/kontext-source-contract'
import type { KontextRequestOwner } from './kontext-request-journal'
import { useKontextHostInventory } from './use-kontext-host-inventory'

export function useKontextSourceInventory(owner: KontextRequestOwner) {
  return useKontextHostInventory<KontextSourceInventory>(owner, async (previous) => {
    const result = kontextSourceInventorySchema.parse(
      await callRuntimeRpc<unknown>(
        owner,
        'kontext.listSources',
        {
          limit: 50,
          includeNativeSessions: true,
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
      result.sources.length > 50 ||
      (result.nativeSessionsIncluded !== true &&
        result.sources.some((source) => 'nativeSession' in source)) ||
      (result.nextCursor &&
        (result.sources.length !== 50 || result.nextCursor.offset !== offset + 50)) ||
      (previous &&
        (result.inventoryDigest !== previous.inventoryDigest ||
          result.nativeSessionsIncluded !== previous.nativeSessionsIncluded ||
          result.organizationId !== previous.organizationId ||
          result.sources.some((source) =>
            previous.sources.some((old) => old.resourceId === source.resourceId)
          )))
    ) {
      throw new Error('Inventory changed')
    }
    return { ...result, sources: [...(previous?.sources ?? []), ...result.sources] }
  })
}
