import {
  kontextRegisteredScheduleSchema,
  kontextRegisteredScheduleSelectorSchema,
  kontextRegisteredScheduleControlSchema,
  kontextRegisteredScheduleResumeSchema
} from '../../../../shared/kontext-registered-schedule-contract'
import { getKontextSidecarService } from '../../../kontext/kontext-sidecar-runtime'
import { defineMethod, type RpcMethod } from '../core'
import { kontextScheduleHistoryMethod } from './kontext-schedule-history'
import { kontextRegisteredIntegrationMethods } from './kontext-registered-integration'

export const kontextRegisteredScheduleMethods: RpcMethod[] = [
  kontextScheduleHistoryMethod,
  ...kontextRegisteredIntegrationMethods,
  ...(
    [
      [
        'kontext.inspectRegisteredSchedule',
        'kontext_inspect_registered_schedule',
        kontextRegisteredScheduleSelectorSchema,
        undefined
      ],
      [
        'kontext.resumeRegisteredSchedule',
        'kontext_resume_registered_schedule',
        kontextRegisteredScheduleResumeSchema,
        'resume'
      ],
      [
        'kontext.cancelRegisteredSchedule',
        'kontext_cancel_registered_schedule',
        kontextRegisteredScheduleControlSchema,
        'cancel'
      ]
    ] as const
  ).map(([name, tool, params, action]) =>
    defineMethod({
      name,
      params,
      handler: async (request, { runtime, signal }) => {
        signal?.throwIfAborted()
        const result = kontextRegisteredScheduleSchema.parse(
          await getKontextSidecarService(runtime.getRuntimeId()).callTool(tool, request)
        )
        signal?.throwIfAborted()
        if (
          result.job.taskId !== request.taskId ||
          result.job.jobId !== request.jobId ||
          result.command?.action !== action ||
          ('expectedJobIdentityDigest' in request &&
            result.jobIdentityDigest !== request.expectedJobIdentityDigest)
        ) {
          throw new Error(
            'Kontext returned a different registered schedule; inspect before retrying'
          )
        }
        return result
      }
    })
  )
]
