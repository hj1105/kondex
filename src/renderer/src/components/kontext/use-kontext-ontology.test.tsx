// @vitest-environment happy-dom

import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { KontextRequestOwner } from './kontext-request-journal'
import { useKontextOntology } from './use-kontext-ontology'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('@/runtime/runtime-rpc-client', () => ({ callRuntimeRpc: mocks.rpc }))

const listResult = { command: 'list', ok: true, sources: [] }

beforeEach(() => {
  mocks.rpc.mockReset().mockResolvedValue(listResult)
})

describe('useKontextOntology', () => {
  it('keeps its actions stable when the caller rebuilds an equal owner object', () => {
    // The Kontext page rebuilds `owner` on every render. Depending on its identity
    // made the panel's load effect refire and spawn a CLI process each time.
    const { result, rerender } = renderHook(
      ({ owner }: { owner: KontextRequestOwner }) => useKontextOntology(owner, 'ws'),
      { initialProps: { owner: { kind: 'local' } as KontextRequestOwner } }
    )
    const first = result.current.refresh
    rerender({ owner: { kind: 'local' } as KontextRequestOwner })
    expect(result.current.refresh).toBe(first)
  })

  it('rebuilds its actions when the owner actually changes', () => {
    const { result, rerender } = renderHook(
      ({ owner }: { owner: KontextRequestOwner }) => useKontextOntology(owner, 'ws'),
      { initialProps: { owner: { kind: 'local' } as KontextRequestOwner } }
    )
    const first = result.current.refresh
    rerender({
      owner: {
        kind: 'environment',
        environmentId: 'env-1',
        pairingRevision: 2
      } as KontextRequestOwner
    })
    expect(result.current.refresh).not.toBe(first)
  })

  it('sends the owner the caller holds now, not the one captured earlier', async () => {
    const { result, rerender } = renderHook(
      ({ owner }: { owner: KontextRequestOwner }) => useKontextOntology(owner, 'ws'),
      { initialProps: { owner: { kind: 'local' } as KontextRequestOwner } }
    )
    const next: KontextRequestOwner = {
      kind: 'environment',
      environmentId: 'env-1',
      pairingRevision: 7
    }
    rerender({ owner: next })
    await result.current.refresh()
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalled())
    expect(mocks.rpc.mock.calls[0]?.[0]).toEqual(next)
    expect(mocks.rpc.mock.calls[0]?.[3]).toMatchObject({ expectedEnvironmentPairingRevision: 7 })
  })
})
