import { describe, expect, it, vi } from 'vitest'
import { getDefaultUIState } from '../../../../shared/constants'
import type { OrcaRuntimeService } from '../../orca-runtime'
import type { RpcRequest } from '../core'
import { RpcDispatcher } from '../dispatcher'
import { CLIENT_UI_METHODS } from './client-ui'

function makeRequest(params: unknown): RpcRequest {
  return { id: 'req-1', authToken: 'tok', method: 'ui.set', params }
}

function makeDispatcher(): { dispatcher: RpcDispatcher; updateUIState: ReturnType<typeof vi.fn> } {
  const updateUIState = vi.fn(() => getDefaultUIState())
  const runtime = {
    getRuntimeId: () => 'test-runtime',
    updateUIState
  } as unknown as OrcaRuntimeService
  return { dispatcher: new RpcDispatcher({ runtime, methods: CLIENT_UI_METHODS }), updateUIState }
}

describe('ui.set task resume state', () => {
  it('discards the retired resume state without persisting it', async () => {
    const { dispatcher, updateUIState } = makeDispatcher()
    const taskResumeState = {
      githubMode: 'items' as const,
      githubItemsQuery: 'is:open'
    }

    const response = await dispatcher.dispatch(makeRequest({ taskResumeState }))

    expect(response).toMatchObject({ ok: true })
    expect(updateUIState).toHaveBeenCalledExactlyOnceWith({})
  })

  it('preserves supported writes beside an unknown nested resume key', async () => {
    const { dispatcher, updateUIState } = makeDispatcher()

    const response = await dispatcher.dispatch(
      makeRequest({
        sidebarWidth: 280,
        taskResumeState: { githubItemsQuery: 'is:open', somethingThisHostPredates: true }
      })
    )

    expect(response).toMatchObject({ ok: true })
    expect(updateUIState).toHaveBeenCalledWith({ sidebarWidth: 280 })
  })

  it.each([
    'featureInteractions',
    'featureInteractionTelemetryBuckets',
    'dismissedUpdateVersion',
    'lastUpdateCheckAt',
    'releaseChannelOverride',
    'pendingUpdateNudgeId',
    'dismissedUpdateNudgeId',
    'updateReassuranceSeen',
    'petVisible',
    'petId',
    'customPets',
    'petSize',
    'sidekickVisible',
    'sidekickId',
    'customSidekicks',
    'sidekickSize',
    'taskResumeState',
    'syncTaskStatusFromWorkspaceBoard',
    '_kimiStatusBarDefaultAdded',
    '_minimaxStatusBarDefaultAdded',
    '_antigravityStatusBarDefaultAdded',
    '_grokStatusBarDefaultAdded'
  ])('ignores retired %s without dropping a supported write', async (field) => {
    const { dispatcher, updateUIState } = makeDispatcher()
    const params = Object.freeze({ sidebarWidth: 280, [field]: { legacy: true } })
    const response = await dispatcher.dispatch(makeRequest(params))

    expect(response).toMatchObject({ ok: true })
    expect(updateUIState).toHaveBeenCalledExactlyOnceWith({ sidebarWidth: 280 })
    expect(params).toHaveProperty(field)
  })

  it.each([[], 'invalid', 42, { sidebarWidth: 280, unknownNewField: true }])(
    'still rejects malformed or unrecognized top-level input: %j',
    async (params) => {
      const { dispatcher, updateUIState } = makeDispatcher()
      const response = await dispatcher.dispatch(makeRequest(params))

      expect(response).toMatchObject({ ok: false, error: { code: 'invalid_argument' } })
      expect(updateUIState).not.toHaveBeenCalled()
    }
  )

  it.each([null, undefined])('keeps the dispatcher empty-params default for %j', async (params) => {
    const { dispatcher, updateUIState } = makeDispatcher()
    const response = await dispatcher.dispatch(makeRequest(params))

    expect(response).toMatchObject({ ok: true })
    expect(updateUIState).toHaveBeenCalledExactlyOnceWith({})
  })
})
