// @vitest-environment happy-dom

import { act, renderHook, waitFor } from '@testing-library/react'
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

  describe('concurrent loads', () => {
    type Pending = { method: string; workspace: string; resolve: (value: unknown) => void }
    let pending: Pending[]

    const source = { name: 'docs', transport: 'local', type: null, target: './docs' }
    const embedding = { provider: 'builtin', model: 'e5', baseUrl: null, apiKeyEnv: null }
    const node = { id: 'n1', description: '', parentId: null, resourceCount: 1, samples: [] }
    const answer = (method: string, workspace: string): unknown =>
      method === 'kontext.listOntologySources'
        ? { command: 'list', ok: true, sources: [{ ...source, name: workspace }], embedding }
        : { command: 'nodes', ok: true, nodes: [{ ...node, id: workspace }], knowledgeStore: null }
    const settle = async (method: string, workspace: string): Promise<void> => {
      const index = pending.findIndex(
        (entry) => entry.method === method && entry.workspace === workspace
      )
      const [entry] = pending.splice(index, 1)
      await act(async () => entry.resolve(answer(method, workspace)))
    }

    beforeEach(() => {
      pending = []
      mocks.rpc.mockImplementation(
        (_owner: unknown, method: string, params: { workspacePath: string }) =>
          new Promise((resolve) =>
            pending.push({ method, workspace: params.workspacePath, resolve })
          )
      )
    })

    const renderOntology = () =>
      renderHook(
        ({ workspace }: { workspace: string }) => useKontextOntology({ kind: 'local' }, workspace),
        { initialProps: { workspace: 'ws-a' } }
      )

    it('keeps both answers when sources and nodes load at once', async () => {
      // Opening a workspace fires both; the later call used to discard the sources.
      const { result } = renderOntology()
      act(() => {
        void result.current.refresh()
        void result.current.loadNodes()
      })
      await settle('kontext.listOntologyNodes', 'ws-a')
      expect(result.current.state.busy).toBe('list')
      await settle('kontext.listOntologySources', 'ws-a')

      expect(result.current.state.sources?.map((entry) => entry.name)).toEqual(['ws-a'])
      expect(result.current.state.embedding).toEqual(embedding)
      expect(result.current.state.nodes?.map((entry) => entry.id)).toEqual(['ws-a'])
      expect(result.current.state.busy).toBeNull()
    })

    it('lets a newer call of the same action supersede an older one', async () => {
      const { result } = renderOntology()
      act(() => {
        void result.current.refresh()
      })
      mocks.rpc.mockImplementationOnce(
        (_owner: unknown, method: string) =>
          new Promise((resolve) => pending.push({ method, workspace: 'second', resolve }))
      )
      act(() => {
        void result.current.refresh()
      })
      await settle('kontext.listOntologySources', 'second')
      await settle('kontext.listOntologySources', 'ws-a')

      expect(result.current.state.sources?.map((entry) => entry.name)).toEqual(['second'])
      expect(result.current.state.busy).toBeNull()
    })

    it('drops late answers for a workspace the panel has left', async () => {
      const { result, rerender } = renderOntology()
      act(() => {
        void result.current.refresh()
        void result.current.loadNodes()
      })
      rerender({ workspace: 'ws-b' })
      act(() => {
        void result.current.refresh()
      })
      await settle('kontext.listOntologySources', 'ws-b')
      await settle('kontext.listOntologySources', 'ws-a')
      await settle('kontext.listOntologyNodes', 'ws-a')

      expect(result.current.state.sources?.map((entry) => entry.name)).toEqual(['ws-b'])
      expect(result.current.state.nodes).toBeNull()
      expect(result.current.state.busy).toBeNull()
    })

    it('drops late answers after a reset', async () => {
      const { result } = renderOntology()
      act(() => {
        void result.current.loadNodes()
        result.current.reset()
      })
      await settle('kontext.listOntologyNodes', 'ws-a')

      expect(result.current.state.nodes).toBeNull()
      expect(result.current.state.busy).toBeNull()
    })
  })
})
