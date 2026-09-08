import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Page } from '@stablyai/playwright-test'
import { installFinalActivationGate } from './pr11346-selected-runtime-identity-oracle'

const page = {
  evaluate: async (callback: (path: string) => Promise<void>, path: string) => callback(path)
} as unknown as Page

afterEach(() => vi.unstubAllGlobals())

describe('selected runtime activation fixture gate', () => {
  it.each([true, false])(
    'preserves an ordinary fetch result of %s while gating activation',
    async (result) => {
      const original = vi.fn().mockResolvedValue(result)
      const state = {
        repos: [
          { id: 'runtime-repo', path: '/fixture/runtime', executionHostId: 'runtime:fixture' }
        ],
        fetchWorktrees: original
      }
      const scope: {
        __store: { getState: () => typeof state; setState: (patch: Partial<typeof state>) => void }
        __pr11346ActivationGate?: { waiting: boolean; release: () => void }
      } = {
        __store: {
          getState: () => state,
          setState: (patch) => {
            Object.assign(state, patch)
          }
        }
      }
      vi.stubGlobal('window', scope)
      await installFinalActivationGate(page, '/fixture/runtime')
      let settled = false
      const options = { executionHostId: 'runtime:fixture' }
      const pending = state.fetchWorktrees('runtime-repo', options).then((value: unknown) => {
        settled = true
        return value
      })
      await vi.waitFor(() => expect(scope.__pr11346ActivationGate?.waiting).toBe(true))
      expect(original).toHaveBeenCalledExactlyOnceWith('runtime-repo', options)
      expect(settled).toBe(false)
      scope.__pr11346ActivationGate?.release()
      await expect(pending).resolves.toBe(result)
    }
  )

  it('forwards the direct SSH authority and its structured result without a boolean conversion', async () => {
    const result = { status: 'fixture-provider-result' }
    const original = vi.fn().mockResolvedValue(result)
    const state = { repos: [], fetchWorktrees: original }
    vi.stubGlobal('window', {
      __store: {
        getState: () => state,
        setState: (patch: Partial<typeof state>) => {
          Object.assign(state, patch)
        }
      }
    })
    await installFinalActivationGate(page, '/fixture/runtime')
    const options = {
      executionHostId: 'ssh:fixture',
      directSshAuthority: { providerEpoch: 'fixture-epoch', connectionGeneration: 7 }
    }
    await expect(state.fetchWorktrees('ssh-repo', options)).resolves.toBe(result)
    expect(original).toHaveBeenCalledExactlyOnceWith('ssh-repo', options)
  })
})
