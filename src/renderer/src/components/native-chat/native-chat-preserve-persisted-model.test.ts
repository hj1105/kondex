// @vitest-environment happy-dom

import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CatalogModel } from '../../../../shared/agent-session-option-catalog'
import type { PersistedNativeChatSessionOptions } from '../../../../shared/native-chat-session-options'
import type { CreateNativeChatPtySessionOptionsArgs } from './native-chat-pty-session-options'
import {
  clearNativeChatModelEnrichmentForTests,
  ensureNativeChatModelEnrichment,
  readNativeChatEnrichedModels
} from './native-chat-session-option-enrichment'

const mocks = vi.hoisted(() => ({
  storeState: {
    settings: {} as { nativeChatSessionOptions?: PersistedNativeChatSessionOptions },
    updateSettings: vi.fn()
  },
  createNativeChatPtySessionOptions: vi.fn(),
  discoverNativeChatCatalogModels: vi.fn(),
  replaceModels: vi.fn()
}))

vi.mock('../../store', () => ({ useAppStore: { getState: () => mocks.storeState } }))
vi.mock('./native-chat-pty-session-options', () => ({
  createNativeChatPtySessionOptions: mocks.createNativeChatPtySessionOptions
}))
vi.mock('./native-chat-session-option-discovery', () => ({
  resolveNativeChatModelDiscoveryContext: () => ({ hostKey: 'local', runtime: {} }),
  discoverNativeChatCatalogModels: mocks.discoverNativeChatCatalogModels
}))

const { useNativeChatSessionOptions } = await import('./use-native-chat-session-options')
const rows = (id: string): CatalogModel[] => [{ id, label: id, options: [] }]

function mountPane(agent: 'claude' | 'codex' = 'claude'): CreateNativeChatPtySessionOptionsArgs {
  renderHook(() =>
    useNativeChatSessionOptions({
      agent,
      terminalTabId: `tab-${agent}`,
      targetPtyId: `pty-${agent}`,
      dispatchCommand: () => undefined
    })
  )
  return mocks.createNativeChatPtySessionOptions.mock.calls.at(-1)![0]
}

describe('model discovery preserves explicit launch preferences', () => {
  beforeEach(() => {
    clearNativeChatModelEnrichmentForTests()
    mocks.storeState.settings = {
      nativeChatSessionOptions: {
        claude: { model: 'private-claude-model' },
        codex: { model: 'private-codex-model' }
      }
    }
    mocks.storeState.updateSettings.mockReset().mockImplementation(async (patch) => {
      mocks.storeState.settings = { ...mocks.storeState.settings, ...patch }
    })
    mocks.discoverNativeChatCatalogModels.mockReset().mockResolvedValue(null)
    mocks.replaceModels.mockReset()
    const snapshot: never[] = []
    mocks.createNativeChatPtySessionOptions.mockReset().mockImplementation(() => ({
      subscribe: () => () => {},
      getSnapshot: () => snapshot,
      recordOutgoingCommand: () => {},
      reportSessionOptions: () => {},
      replaceModels: mocks.replaceModels
    }))
  })

  afterEach(cleanup)

  it('uses cached picker rows on mount without erasing a custom launch model', async () => {
    ensureNativeChatModelEnrichment({
      agent: 'claude',
      hostKey: 'local',
      discover: async () => rows('sonnet')
    })
    await vi.waitFor(() => expect(readNativeChatEnrichedModels('claude', 'local')).not.toBeNull())

    expect(mountPane().initialModels).toEqual(rows('sonnet'))
    expect(mocks.storeState.updateSettings).not.toHaveBeenCalled()
    expect(mocks.storeState.settings.nativeChatSessionOptions?.claude?.model).toBe(
      'private-claude-model'
    )
  })

  it('publishes late picker rows without replacing a user choice made during the probe', async () => {
    let settle!: (models: CatalogModel[]) => void
    mocks.discoverNativeChatCatalogModels.mockReturnValue(
      new Promise<CatalogModel[]>((resolve) => {
        settle = resolve
      })
    )
    mountPane()
    expect(mocks.storeState.updateSettings).not.toHaveBeenCalled()
    mocks.storeState.settings.nativeChatSessionOptions!.claude = { model: 'new-user-choice' }

    await act(async () => {
      settle(rows('sonnet'))
      await Promise.resolve()
    })
    expect(mocks.replaceModels).toHaveBeenCalledWith(rows('sonnet'))
    expect(mocks.storeState.updateSettings).not.toHaveBeenCalled()
    expect(mocks.storeState.settings.nativeChatSessionOptions?.claude?.model).toBe(
      'new-user-choice'
    )
  })

  it.each([null, []])(
    'does not write preferences when discovery returns %j',
    async (discovered) => {
      mocks.discoverNativeChatCatalogModels.mockResolvedValue(discovered)
      mountPane()
      await act(async () => {
        await Promise.resolve()
      })
      expect(mocks.replaceModels).not.toHaveBeenCalled()
      expect(mocks.storeState.updateSettings).not.toHaveBeenCalled()
    }
  )

  it('serializes explicit selections from two panes against the latest settings', async () => {
    const claude = mountPane('claude')
    const codex = mountPane('codex')
    await act(async () => {
      await Promise.all([
        claude.persistSelection!({
          modelId: 'opus',
          optionId: 'effort',
          value: 'high',
          adoptModelAsLaunchDefault: true
        }),
        codex.persistSelection!({
          modelId: 'account-codex',
          optionId: 'effort',
          value: 'low',
          adoptModelAsLaunchDefault: true
        })
      ])
    })
    expect(mocks.storeState.updateSettings).toHaveBeenCalledTimes(2)
    expect(mocks.storeState.settings.nativeChatSessionOptions).toEqual({
      claude: { model: 'opus', valuesByModel: { opus: { effort: 'high' } } },
      codex: { model: 'account-codex', valuesByModel: { 'account-codex': { effort: 'low' } } }
    })
  })
})
