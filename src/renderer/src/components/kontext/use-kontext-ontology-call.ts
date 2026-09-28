import { useCallback, useLayoutEffect, useRef } from 'react'
import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import type { OntologyCall } from './use-kontext-embedding-actions'
import type { OntologyAction, OntologyState } from './kontext-ontology-state'
import type { KontextRequestOwner } from './kontext-request-journal'

/**
 * Runs one ontology RPC and decides whether its answer still applies.
 *
 * Why per action: the panel loads sources and nodes at once, and one shared counter
 * let the later call discard the earlier one's answer. A newer call of the same
 * action still supersedes an older one; `generation` drops every answer asked
 * before a workspace or owner change, or an `invalidate()` from reset.
 */
export function useKontextOntologyCall(
  stableOwner: KontextRequestOwner,
  workspace: string,
  setState: React.Dispatch<React.SetStateAction<OntologyState>>
): { call: OntologyCall; invalidate: () => void } {
  const generation = useRef(0)
  const sequence = useRef(0)
  const latestByAction = useRef(new Map<OntologyAction, number>())
  const inFlight = useRef(new Map<number, OntologyAction>())
  const invalidate = useCallback(() => {
    generation.current += 1
    latestByAction.current.clear()
    inFlight.current.clear()
  }, [])
  // Why layout: it runs in the commit, before the load effect asks the new workspace.
  useLayoutEffect(invalidate, [workspace, stableOwner, invalidate])

  const call = useCallback(
    async <T>(
      action: OntologyAction,
      method: string,
      params: Record<string, unknown>,
      parse: (value: unknown) => T,
      timeoutMs: number
    ): Promise<T | null> => {
      const ticket = (sequence.current += 1)
      const askedIn = generation.current
      latestByAction.current.set(action, ticket)
      inFlight.current.set(ticket, action)
      const isCurrent = (): boolean =>
        askedIn === generation.current && latestByAction.current.get(action) === ticket
      setState((previous) => ({
        ...previous,
        busy: action,
        error: null,
        errorAction: null,
        notice: null
      }))
      try {
        const response = await callRuntimeRpc<unknown>(stableOwner, method, params, {
          expectedEnvironmentPairingRevision:
            stableOwner.kind === 'environment' ? stableOwner.pairingRevision : undefined,
          timeoutMs
        })
        if (!isCurrent()) {
          return null
        }
        return parse(response)
      } catch (caught) {
        if (!isCurrent()) {
          return null
        }
        setState((previous) => ({
          ...previous,
          error: caught instanceof Error ? caught.message : String(caught),
          errorAction: action
        }))
        return null
      } finally {
        // Why: another action may still be running; stay busy with the latest of them.
        // A call dropped by invalidate() is already gone and leaves `busy` alone.
        if (inFlight.current.delete(ticket)) {
          const running = [...inFlight.current.values()].at(-1) ?? null
          setState((previous) => ({ ...previous, busy: running }))
        }
      }
    },
    [setState, stableOwner]
  )

  return { call, invalidate }
}
