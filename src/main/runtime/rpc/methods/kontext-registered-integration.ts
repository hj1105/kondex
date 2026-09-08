import { kontextRegisteredScheduleSelectorSchema } from '../../../../shared/kontext-registered-schedule-contract'
import {
  kontextRegisteredIntegrationSchema,
  kontextRegisteredIntegrationRequestSchema
} from '../../../../shared/kontext-registered-integration-contract'
import { getKontextSidecarService } from '../../../kontext/kontext-sidecar-runtime'
import { defineMethod, type RpcMethod } from '../core'

export const kontextRegisteredIntegrationMethods: RpcMethod[] = (
  [
    [
      'kontext.inspectRegisteredIntegration',
      'kontext_inspect_registered_integration',
      kontextRegisteredScheduleSelectorSchema,
      undefined
    ],
    [
      'kontext.integrateRegisteredSchedule',
      'kontext_integrate_registered_schedule',
      kontextRegisteredIntegrationRequestSchema,
      'integrate'
    ]
  ] as const
).map(([name, tool, params, command]) =>
  defineMethod({
    name,
    params,
    handler: async (request, { runtime, signal }) => {
      signal?.throwIfAborted()
      const result = kontextRegisteredIntegrationSchema.parse(
        await getKontextSidecarService(runtime.getRuntimeId()).callTool(tool, request)
      )
      signal?.throwIfAborted()
      if (
        result.taskId !== request.taskId ||
        result.jobId !== request.jobId ||
        result.command !== command ||
        ('expectedJobIdentityDigest' in request &&
          result.jobIdentityDigest !== request.expectedJobIdentityDigest)
      ) {
        throw new Error('Registered integration outcome unknown; inspect before retrying')
      }
      return result
    }
  })
)
