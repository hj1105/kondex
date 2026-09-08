import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  kontextRuntimeInspectionSchema,
  type KontextRuntimeInspection
} from '../../../../shared/kontext-runtime-contract'
import { callRuntimeRpc, getActiveRuntimeTarget } from '@/runtime/runtime-rpc-client'
import { useAppStore } from '@/store'

type InspectionState =
  | { status: 'loading' }
  | { status: 'settled'; value: KontextRuntimeInspection }

export function useKontextRuntimeInspection(): {
  state: InspectionState
  refresh: () => void
} {
  const activeRuntimeEnvironmentId = useAppStore(
    (store) => store.settings?.activeRuntimeEnvironmentId
  )
  const target = useMemo(
    () => getActiveRuntimeTarget({ activeRuntimeEnvironmentId }),
    [activeRuntimeEnvironmentId]
  )
  const [refreshGeneration, setRefreshGeneration] = useState(0)
  const [state, setState] = useState<InspectionState>({ status: 'loading' })

  const refresh = useCallback(() => {
    setRefreshGeneration((generation) => generation + 1)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setState({ status: 'loading' })

    void callRuntimeRpc<unknown>(target, 'kontext.inspectRuntimes', undefined, {
      signal: controller.signal
    })
      .then((result) => {
        if (controller.signal.aborted) {
          return
        }
        const parsed = kontextRuntimeInspectionSchema.safeParse(result)
        setState({
          status: 'settled',
          value: parsed.success
            ? parsed.data
            : {
                status: 'unavailable',
                diagnostic: 'The runtime returned an invalid Kontext inspection response.'
              }
        })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return
        }
        const diagnostic =
          error instanceof Error && error.message.trim().length > 0
            ? error.message
            : 'The Kontext runtime inspection failed.'
        setState({ status: 'settled', value: { status: 'unavailable', diagnostic } })
      })

    return () => controller.abort()
  }, [refreshGeneration, target])

  return { state, refresh }
}
