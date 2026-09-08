import {
  kontextMarkdownSourceRequestSchema,
  kontextMarkdownSourceResultSchema,
  kontextSourceIdentitySchema,
  kontextSourceInspectionSchema,
  kontextSourceSharingRequestSchema
} from '../../../../shared/kontext-source-contract'
import {
  kontextSourceInventoryRequestSchema,
  kontextSourceInventorySchema
} from '../../../../shared/kontext-source-contract'
import { getKontextSidecarService } from '../../../kontext/kontext-sidecar-runtime'
import { defineMethod } from '../core'

export const kontextRegisterMarkdownSourceMethod = defineMethod({
  name: 'kontext.registerMarkdownSource',
  params: kontextMarkdownSourceRequestSchema,
  handler: async ({ workspace, relativePath }, { runtime, signal }) => {
    signal?.throwIfAborted()
    const workspacePath = await runtime.resolveKontextSourceWorkspace(workspace)
    signal?.throwIfAborted()
    const response = await getKontextSidecarService(runtime.getRuntimeId()).callTool(
      'kontext_register_markdown_source',
      {
        workspacePath,
        relativePath
      }
    )
    const result = kontextMarkdownSourceResultSchema.parse(response)
    if (result.title !== relativePath.replaceAll('\\', '/')) {
      throw new Error(
        'Kontext did not confirm the selected source; registration outcome is unknown.'
      )
    }
    return result
  }
})

function confirmSource(response: unknown, resourceId: string) {
  const result = kontextSourceInspectionSchema.parse(response)
  if (result.resourceId !== resourceId) {
    throw new Error('Kontext returned a different source.')
  }
  return result
}
export const kontextSourceManagementMethods = [
  defineMethod({
    name: 'kontext.listSources',
    params: kontextSourceInventoryRequestSchema,
    handler: async (request, { runtime, signal }) => {
      signal?.throwIfAborted()
      const result = kontextSourceInventorySchema.parse(
        await getKontextSidecarService(runtime.getRuntimeId()).callTool(
          'kontext_list_sources',
          request
        )
      )
      signal?.throwIfAborted()
      if (
        result.sources.length > request.limit ||
        (request.cursor && result.inventoryDigest !== request.cursor.digest) ||
        (result.nextCursor &&
          (result.sources.length !== request.limit ||
            result.nextCursor.offset !== (request.cursor?.offset ?? 0) + request.limit))
      ) {
        throw new Error('Source inventory changed; reload its first page.')
      }
      return result
    }
  }),
  defineMethod({
    name: 'kontext.inspectSource',
    params: kontextSourceIdentitySchema,
    handler: async (request, { runtime, signal }) => {
      signal?.throwIfAborted()
      return confirmSource(
        await getKontextSidecarService(runtime.getRuntimeId()).callTool(
          'kontext_inspect_source',
          request
        ),
        request.resourceId
      )
    }
  }),
  defineMethod({
    name: 'kontext.refreshSource',
    params: kontextSourceIdentitySchema,
    handler: async (request, { runtime, signal }) => {
      signal?.throwIfAborted()
      const sidecar = getKontextSidecarService(runtime.getRuntimeId())
      const refreshed = kontextMarkdownSourceResultSchema.parse(
        await sidecar.callTool('kontext_refresh_source', request)
      )
      if (refreshed.resourceId !== request.resourceId) {
        throw new Error('Kontext returned a different source.')
      }
      return confirmSource(
        await sidecar.callTool('kontext_inspect_source', request),
        request.resourceId
      )
    }
  }),
  defineMethod({
    name: 'kontext.setSourceSharing',
    params: kontextSourceSharingRequestSchema,
    handler: async (request, { runtime, signal }) => {
      signal?.throwIfAborted()
      const result = confirmSource(
        await getKontextSidecarService(runtime.getRuntimeId()).callTool(
          'kontext_set_source_sharing',
          request
        ),
        request.resourceId
      )
      if (
        result.revision !== request.expectedRevision + 1 ||
        result.contentHash !== request.expectedContentHash ||
        result.sharing?.dataClassification !== request.dataClassification ||
        JSON.stringify([...new Set(result.sharing.allowedRuntimeProviders)].sort()) !==
          JSON.stringify([...new Set(request.allowedRuntimeProviders)].sort())
      ) {
        throw new Error(
          'Source sharing was not confirmed; inspect its current state before retrying.'
        )
      }
      return result
    }
  })
]
