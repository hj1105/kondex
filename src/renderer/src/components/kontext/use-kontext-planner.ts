import { useEffect, useRef, useState } from 'react'
import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import { getRuntimeEnvironmentRevision } from '@/runtime/runtime-environment-revision'
import {
  confirmKontextPlanRefinement,
  kontextPlanRefinementRequestSchema,
  kontextPlanApprovedSchema,
  kontextPlanRequestSchema,
  kontextPlanStartedSchema,
  kontextPlanViewSchema,
  type KontextPlanRequest,
  type KontextPlanView
} from '../../../../shared/kontext-planning-contract'
import type { KontextRequestOwner } from './kontext-request-journal'
import { readKontextPlans, saveKontextPlan, type KontextPlanEntry } from './kontext-plan-journal'

export function useKontextPlanner(
  owner: KontextRequestOwner,
  onCreated: (taskId: string, workspace: string) => void
) {
  const [initial] = useState(() => {
    try {
      return { entries: readKontextPlans(window.localStorage, owner), storage: true }
    } catch {
      return { entries: [], storage: false }
    }
  })
  const [entries, setEntries] = useState(initial.entries)
  const [selected, setSelected] = useState<string | null>(initial.entries[0]?.requestId ?? null)
  const [plan, setPlan] = useState<KontextPlanView | null>(null)
  const [error, setError] = useState<'failed' | 'ownerChanged' | 'storage' | null>(
    initial.storage ? null : 'storage'
  )
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const alive = useRef(true)
  const entry = entries.find((entry) => entry.requestId === selected)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  function assertOwner() {
    if (
      !alive.current ||
      (owner.kind === 'environment' &&
        getRuntimeEnvironmentRevision(owner.environmentId) !== owner.pairingRevision)
    ) {
      throw new Error('ownerChanged')
    }
  }
  async function rpc(method: string, params: unknown) {
    assertOwner()
    const result = await callRuntimeRpc<unknown>(owner, method, params, {
      expectedEnvironmentPairingRevision:
        owner.kind === 'environment' ? owner.pairingRevision : undefined,
      timeoutMs: 60_000
    })
    assertOwner()
    return result
  }
  async function run(action: () => Promise<void>) {
    if (inFlight.current) {
      return
    }
    inFlight.current = true
    setBusy(true)
    setError(null)
    try {
      assertOwner()
      await action()
    } catch (error) {
      if (alive.current) {
        setError(
          error instanceof Error && error.message === 'ownerChanged' ? 'ownerChanged' : 'failed'
        )
        setPlan(null)
      }
    } finally {
      inFlight.current = false
      if (alive.current) {
        setBusy(false)
      }
    }
  }
  function confirmPlan(result: KontextPlanView, saved: KontextPlanEntry) {
    if (result.request.requestId !== saved.requestId) {
      throw new Error('Plan mismatch')
    }
    if (saved.refinementRequest) {
      confirmKontextPlanRefinement(result, saved.refinementRequest)
    }
  }
  async function dispatchSaved(saved: KontextPlanEntry) {
    saveKontextPlan(window.localStorage, saved)
    setEntries((current) => [saved, ...current])
    setSelected(saved.requestId)
    setPlan(null)
    await recoverSaved(saved)
  }
  async function recoverSaved(saved: KontextPlanEntry) {
    const request = saved.refinementRequest ?? saved.request
    if (!request) {
      return
    }
    const result = kontextPlanStartedSchema.parse(
      await rpc(saved.refinementRequest ? 'kontext.refinePlan' : 'kontext.startPlan', request)
    )
    confirmPlan(result.plan, saved)
    setPlan(result.plan)
  }
  const inspect = () =>
    run(async () => {
      if (!entry) {
        return
      }
      const result = kontextPlanViewSchema.parse(
        await rpc('kontext.inspectPlan', { requestId: entry.requestId })
      )
      confirmPlan(result, entry)
      setPlan(result)
    })
  return {
    entries,
    entry,
    plan,
    error,
    busy,
    storageAvailable: initial.storage,
    select: (id: string) => {
      if (!inFlight.current) {
        setSelected(id)
        setPlan(null)
        setError(null)
      }
    },
    newPlan: () => {
      if (!inFlight.current) {
        setSelected(null)
        setPlan(null)
        setError(null)
      }
    },
    start: (input: Omit<KontextPlanRequest, 'requestId'>) =>
      run(async () => {
        if (!initial.storage || entry) {
          throw new Error('Read the existing request before starting another plan')
        }
        const request = kontextPlanRequestSchema.parse({ ...input, requestId: crypto.randomUUID() })
        const saved = {
          owner,
          requestId: request.requestId,
          workspace: request.workspace,
          createdAt: new Date().toISOString(),
          request
        }
        await dispatchSaved(saved)
      }),
    refine: (feedback: string) =>
      run(async () => {
        if (!initial.storage || !entry || plan?.status !== 'review' || !plan.planDigest) {
          throw new Error('Read the unapproved parent before refining it')
        }
        confirmPlan(plan, entry)
        const refinementRequest = kontextPlanRefinementRequestSchema.parse({
          requestId: crypto.randomUUID(),
          parentRequestId: entry.requestId,
          expectedParentDigest: plan.planDigest,
          feedback
        })
        await dispatchSaved({
          owner,
          requestId: refinementRequest.requestId,
          workspace: entry.workspace,
          createdAt: new Date().toISOString(),
          refinementRequest
        })
      }),
    inspect,
    recover: () =>
      run(async () => {
        if (entry) {
          await recoverSaved(entry)
        }
      }),
    cancel: () =>
      run(async () => {
        if (!entry) {
          return
        }
        const result = kontextPlanViewSchema.parse(
          await rpc('kontext.cancelPlan', { requestId: entry.requestId })
        )
        confirmPlan(result, entry)
        setPlan(result)
      }),
    approve: () =>
      run(async () => {
        if (!entry || !plan?.planDigest || plan.status !== 'review') {
          return
        }
        const result = kontextPlanApprovedSchema.parse(
          await rpc('kontext.approvePlan', {
            requestId: entry.requestId,
            expectedPlanDigest: plan.planDigest
          })
        )
        if (result.requestId !== entry.requestId || result.planDigest !== plan.planDigest) {
          throw new Error('Plan mismatch')
        }
        setPlan({ ...plan, status: 'approved', taskId: result.taskId })
        onCreated(result.taskId, entry.workspace)
      }),
    open: () =>
      run(async () => {
        assertOwner()
        if (entry && plan?.status === 'approved' && plan.taskId) {
          onCreated(plan.taskId, entry.workspace)
        }
      })
  }
}
