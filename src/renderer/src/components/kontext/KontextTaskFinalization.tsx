import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import { getRuntimeEnvironmentRevision } from '@/runtime/runtime-environment-revision'
import {
  kontextFinalizationInspectionSchema,
  kontextFinalizationResultSchema,
  type KontextFinalizationRecord
} from '../../../../shared/kontext-finalization-contract'
import { readKontextFinalizations, saveKontextFinalization } from './kontext-finalization-journal'
import type { KontextRequestOwner } from './kontext-request-journal'
import { getKontextFinalizationCopy } from './kontext-finalization-copy'
import { KontextFinalizationRevalidation } from './KontextFinalizationRevalidation'

export function KontextTaskFinalization({
  owner,
  taskId,
  jobId,
  basis,
  ready,
  disabled,
  expectedRecordId
}: {
  owner: KontextRequestOwner
  taskId: string
  jobId: string
  basis?: string
  ready: boolean
  disabled: boolean
  expectedRecordId?: string
}): React.JSX.Element {
  const copy = getKontextFinalizationCopy()
  const [initial] = useState(() => {
    if (expectedRecordId) {
      return { entries: [], storage: true }
    }
    try {
      return { entries: readKontextFinalizations(window.localStorage, owner), storage: true }
    } catch {
      return { entries: [], storage: false }
    }
  })
  const [entry, setEntry] = useState(
    initial.entries.find(
      (item) =>
        item.request.taskId === taskId &&
        item.request.jobId === jobId &&
        (!basis || item.request.expectedCompletionBasisDigest === basis)
    )
  )
  const [record, setRecord] = useState<KontextFinalizationRecord | null>(null)
  const [read, setRead] = useState(false)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const running = useRef(false)
  const alive = useRef(true)
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
      throw new Error('Runtime pairing changed')
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
  async function run(finalize: boolean) {
    if (running.current || disabled) {
      return
    }
    running.current = true
    setBusy(true)
    setError(false)
    setRecord(null)
    setRead(false)
    try {
      assertOwner()
      if (finalize) {
        if (expectedRecordId || !initial.storage || !ready || !basis || !consent) {
          throw new Error('Review current completion evidence first')
        }
        const value = entry ?? {
          owner,
          request: {
            taskId,
            jobId,
            requestId: crypto.randomUUID(),
            expectedCompletionBasisDigest: basis
          },
          createdAt: new Date().toISOString()
        }
        saveKontextFinalization(window.localStorage, value)
        setEntry(value)
        const response = kontextFinalizationResultSchema.parse(
          await rpc('kontext.finalizeTask', value.request)
        )
        if (JSON.stringify(response.record.request) !== JSON.stringify(value.request)) {
          throw new Error('Finalization identity mismatch')
        }
        setRecord(response.record)
      } else {
        const response = kontextFinalizationInspectionSchema.parse(
          await rpc('kontext.inspectFinalization', {
            taskId,
            ...(entry ? { requestId: entry.request.requestId } : {})
          })
        )
        if (
          response.taskId !== taskId ||
          (response.record &&
            (response.record.request.taskId !== taskId ||
              (expectedRecordId &&
                (response.record.recordId !== expectedRecordId ||
                  response.record.request.jobId !== jobId)) ||
              (entry && response.record.request.requestId !== entry.request.requestId)))
        ) {
          throw new Error('Finalization identity mismatch')
        }
        setRecord(response.record)
      }
      setRead(true)
    } catch {
      if (alive.current) {
        setError(true)
      }
    } finally {
      running.current = false
      if (alive.current) {
        setBusy(false)
      }
    }
  }
  return (
    <div className="space-y-3 border-t border-border pt-4">
      <h4 className="text-sm font-medium">{copy.title}</h4>
      {(!expectedRecordId || !record) && (
        <p className="text-xs leading-5 text-muted-foreground">
          {expectedRecordId ? copy.historical : copy.notice}
        </p>
      )}
      {!initial.storage && (
        <p role="alert" className="text-xs text-destructive">
          {copy.storage}
        </p>
      )}
      {!expectedRecordId && (
        <div className="flex items-start gap-2">
          <Checkbox
            id="kontext-finalization-consent"
            checked={consent}
            disabled={busy || disabled || !ready || !basis}
            onCheckedChange={(value) => setConsent(value === true)}
          />
          <Label htmlFor="kontext-finalization-consent" className="text-xs font-normal leading-5">
            {copy.consent}
          </Label>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {!expectedRecordId && (
          <Button
            disabled={busy || disabled || !ready || !basis || !consent || !initial.storage}
            onClick={() => void run(true)}
          >
            {entry ? copy.recover : copy.finalize}
          </Button>
        )}
        <Button variant="outline" disabled={busy || disabled} onClick={() => void run(false)}>
          {copy.inspect}
        </Button>
      </div>
      {busy && (
        <p role="status" className="text-xs text-muted-foreground">
          {copy.busy}
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {copy.error}
        </p>
      )}
      {read && !record && (
        <p role="status" className="text-xs text-muted-foreground">
          {copy.absent}
        </p>
      )}
      {record && (
        <div className="space-y-2 text-xs" aria-live="polite">
          <p className="font-medium">
            {copy.recorded}: {record.completedAt}
          </p>
          <p className="text-muted-foreground">{copy.historical}</p>
          <p className="break-all font-mono">
            {record.request.jobId} · {record.gitCommit}
          </p>
          <p className="break-all font-mono">{record.accuracyManifestId}</p>
          <KontextFinalizationRevalidation
            key={`${JSON.stringify(owner)}:${record.recordId}`}
            owner={owner}
            record={record}
            disabled={disabled || busy}
          />
        </div>
      )}
    </div>
  )
}
