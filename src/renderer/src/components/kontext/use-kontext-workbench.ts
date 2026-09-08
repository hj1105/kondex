import { useRef, useState } from 'react'
import {
  kontextIntegrationResultSchema,
  kontextScheduleJobSchema,
  type KontextScheduleLogicRequest
} from '../../../../shared/kontext-schedule-contract'
import {
  kontextTaskInspectionSchema,
  type KontextTaskInspection
} from '../../../../shared/kontext-task-inspection-contract'
import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import { getRuntimeEnvironmentRevision } from '@/runtime/runtime-environment-revision'
import {
  readKontextRequests,
  saveKontextRequest,
  type KontextRequestEntry,
  type KontextRequestOwner
} from './kontext-request-journal'

export function useKontextWorkbench(owner: KontextRequestOwner) {
  const [initial] = useState(() => {
    try {
      return { entries: readKontextRequests(window.localStorage, owner), error: null }
    } catch {
      return {
        entries: [],
        error:
          'Saved requests could not be read. Execution is disabled to preserve recovery information.'
      }
    }
  })
  const [entries, setEntries] = useState<KontextRequestEntry[]>(initial.entries)
  const [task, setTask] = useState<KontextTaskInspection | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(
    initial.entries[0]?.request.requestId ?? null
  )
  const [error, setError] = useState<string | null>(initial.error)
  const [busy, setBusy] = useState<string | null>(null)
  const [integration, setIntegration] = useState<ReturnType<
    typeof kontextIntegrationResultSchema.parse
  > | null>(null)
  const inFlight = useRef(false)
  const entry = entries.find((item) => item.request.requestId === selectedId) ?? null

  function assertOwner() {
    if (
      owner.kind === 'environment' &&
      getRuntimeEnvironmentRevision(owner.environmentId) !== owner.pairingRevision
    ) {
      throw new Error('The selected runtime pairing changed. Reload the task before executing.')
    }
  }
  function rpc(method: string, params: unknown) {
    assertOwner()
    return callRuntimeRpc<unknown>(owner, method, params, {
      expectedEnvironmentPairingRevision:
        owner.kind === 'environment' ? owner.pairingRevision : undefined,
      timeoutMs: 10 * 60_000
    })
  }
  function persist(value: KontextRequestEntry) {
    saveKontextRequest(window.localStorage, value)
    setEntries((current) => [
      value,
      ...current.filter((item) => item.request.requestId !== value.request.requestId)
    ])
  }
  async function run(name: string, action: () => Promise<void>) {
    if (inFlight.current) {
      return
    }
    inFlight.current = true
    setBusy(name)
    setError(null)
    try {
      await action()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Kontext could not confirm the operation.')
    } finally {
      inFlight.current = false
      setBusy(null)
    }
  }
  async function observe(value: KontextRequestEntry, method: string, params: unknown) {
    try {
      const job = kontextScheduleJobSchema.parse(await rpc(method, params))
      if (
        job.taskId !== value.request.taskId ||
        job.requestId !== value.request.requestId ||
        (value.job && job.jobId !== value.job.jobId)
      ) {
        throw new Error(
          'Kontext returned a different task or request. The execution outcome is unknown.'
        )
      }
      persist({ ...value, phase: 'accepted', job, updatedAt: new Date().toISOString() })
    } catch (cause) {
      persist({ ...value, phase: 'unknown', updatedAt: new Date().toISOString() })
      throw cause
    }
  }
  function loadTask(taskId: string) {
    return run('load', async () => {
      setTask(null)
      setIntegration(null)
      setSelectedId(
        entries.find((value) => value.request.taskId === taskId)?.request.requestId ?? null
      )
      const result = kontextTaskInspectionSchema.parse(await rpc('kontext.inspectTask', { taskId }))
      assertOwner()
      if (result.taskId !== taskId || (result.contract && result.contract.taskId !== taskId)) {
        throw new Error('Kontext returned a different task.')
      }
      setTask(result)
    })
  }
  function enqueue(request: KontextScheduleLogicRequest) {
    return run('enqueue', async () => {
      if (
        initial.error ||
        !task?.contract ||
        task.status !== 'current' ||
        request.taskId !== task.taskId
      ) {
        throw new Error('Load a current prepared task before execution.')
      }
      assertOwner()
      const unresolved = readKontextRequests(window.localStorage, owner).some(
        (saved) =>
          saved.request.taskId === request.taskId &&
          (saved.phase !== 'accepted' ||
            !saved.job ||
            !['completed', 'failed', 'cancelled'].includes(saved.job.status))
      )
      if (unresolved) {
        throw new Error(
          'An existing request for this task needs recovery or settlement before another schedule can start.'
        )
      }
      const value: KontextRequestEntry = {
        version: 1,
        owner,
        request: { ...request, requestId: crypto.randomUUID() },
        phase: 'pending',
        updatedAt: new Date().toISOString()
      }
      persist(value)
      setSelectedId(value.request.requestId)
      setIntegration(null)
      await observe(value, 'kontext.enqueueSchedule', value.request)
    })
  }
  function retry() {
    return run('retry', async () => {
      if (initial.error || !entry) {
        throw new Error('No saved request is selected.')
      }
      await observe(entry, 'kontext.enqueueSchedule', entry.request)
    })
  }
  function refresh() {
    return run('refresh', async () => {
      if (!entry?.job) {
        throw new Error('Recover the original enqueue response first.')
      }
      await observe(entry, 'kontext.refreshSchedule', {
        jobId: entry.job.jobId,
        allowAutomaticResume: true
      })
    })
  }
  function cancel() {
    return run('cancel', async () => {
      if (!entry?.job) {
        throw new Error('Recover the original enqueue response first.')
      }
      await observe(entry, 'kontext.cancelSchedule', { jobId: entry.job.jobId })
    })
  }
  function integrate() {
    return run('integrate', async () => {
      if (!entry?.job) {
        throw new Error('No accepted schedule is selected.')
      }
      const result = kontextIntegrationResultSchema.parse(
        await rpc('kontext.integrateSchedule', {
          jobId: entry.job.jobId,
          observedAt: new Date().toISOString(),
          nextAttemptAt: new Date(Date.now() + 60_000).toISOString()
        })
      )
      if (
        result.state.scheduleJobId !== entry.job.jobId ||
        result.state.taskId !== entry.request.taskId
      ) {
        throw new Error('Kontext returned integration evidence for a different task.')
      }
      setIntegration(result)
    })
  }
  function select(id: string) {
    setSelectedId(id)
    setIntegration(null)
    setError(initial.error)
  }
  return {
    task,
    entries,
    entry,
    error,
    busy,
    integration,
    storageAvailable: !initial.error,
    loadTask,
    enqueue,
    retry,
    refresh,
    cancel,
    integrate,
    select
  }
}
