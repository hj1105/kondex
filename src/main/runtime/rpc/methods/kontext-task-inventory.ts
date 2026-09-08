import {
  kontextTaskInventoryRequestSchema,
  kontextTaskInventorySchema
} from '../../../../shared/kontext-task-inventory-contract'
import { getKontextSidecarService } from '../../../kontext/kontext-sidecar-runtime'
import { defineMethod } from '../core'

export const kontextTaskInventoryMethod = defineMethod({
  name: 'kontext.listTasks',
  params: kontextTaskInventoryRequestSchema,
  handler: async (request, { runtime, signal }) => {
    signal?.throwIfAborted()
    const result = kontextTaskInventorySchema.parse(
      await getKontextSidecarService(runtime.getRuntimeId()).callTool('kontext_list_tasks', request)
    )
    signal?.throwIfAborted()
    if (
      result.tasks.length > request.limit ||
      (request.workspaceId &&
        result.tasks.some((task) => task.workspaceId !== request.workspaceId)) ||
      (request.cursor && result.inventoryDigest !== request.cursor.digest) ||
      (result.nextCursor &&
        (result.tasks.length !== request.limit ||
          result.nextCursor.offset !== (request.cursor?.offset ?? 0) + request.limit))
    ) {
      throw new Error('Kontext returned a different Task inventory')
    }
    return result
  }
})
