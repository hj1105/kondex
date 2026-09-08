import { getAppEnvironment } from '../../../../shared/app-environment'
import { defineMethod, type RpcMethod } from '../core'

export const STATUS_METHODS: RpcMethod[] = [
  defineMethod({
    name: 'status.get',
    params: null,
    handler: (_params, { runtime, pairedDeviceId }) => {
      return {
        ...runtime.getStatus(),
        ...(pairedDeviceId ? { pairedDeviceId } : {}),
        appVersion: getAppEnvironment().getVersion()
      }
    }
  })
]
