import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import { getRuntimeEnvironmentRevision } from '@/runtime/runtime-environment-revision'
import {
  kontextFinalizationRevalidationSchema,
  type KontextFinalizationRecord
} from '../../../../shared/kontext-finalization-contract'
import type { KontextRequestOwner } from './kontext-request-journal'
import { getKontextFinalizationCopy } from './kontext-finalization-copy'

export function KontextFinalizationRevalidation({
  owner,
  record,
  disabled
}: {
  owner: KontextRequestOwner
  record: KontextFinalizationRecord
  disabled: boolean
}) {
  const copy = getKontextFinalizationCopy()
  const [result, setResult] = useState<ReturnType<
    typeof kontextFinalizationRevalidationSchema.parse
  > | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(false)
  const [error, setError] = useState(false)
  const running = useRef(false)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  useEffect(() => {
    setProgress(false)
    if (!busy) {
      return
    }
    const timer = window.setTimeout(() => setProgress(true), 250)
    return () => window.clearTimeout(timer)
  }, [busy])
  function assertOwner() {
    if (
      !alive.current ||
      (owner.kind === 'environment' &&
        getRuntimeEnvironmentRevision(owner.environmentId) !== owner.pairingRevision)
    ) {
      throw new Error('Owning runtime changed')
    }
  }
  async function revalidate() {
    if (running.current || disabled) {
      return
    }
    running.current = true
    setBusy(true)
    setResult(null)
    setError(false)
    try {
      assertOwner()
      const response = kontextFinalizationRevalidationSchema.parse(
        await callRuntimeRpc<unknown>(
          owner,
          'kontext.revalidateFinalization',
          {
            taskId: record.request.taskId,
            expectedRecordId: record.recordId
          },
          {
            expectedEnvironmentPairingRevision:
              owner.kind === 'environment' ? owner.pairingRevision : undefined,
            timeoutMs: 60_000
          }
        )
      )
      assertOwner()
      if (
        response.taskId !== record.request.taskId ||
        response.recordId !== record.recordId ||
        response.recordedCompletionBasisDigest !== record.request.expectedCompletionBasisDigest
      ) {
        throw new Error('Revalidation identity mismatch')
      }
      setResult(response)
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
    <div className="space-y-2 border-t border-border pt-3">
      <p className="text-xs leading-5 text-muted-foreground">{copy.revalidationNotice}</p>
      <Button variant="outline" disabled={busy || disabled} onClick={() => void revalidate()}>
        {copy.revalidate}
      </Button>
      {progress && (
        <p role="status" className="text-xs text-muted-foreground">
          {copy.busy}
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {copy.revalidationError}
        </p>
      )}
      {result && (
        <p role="status" className="text-xs">
          {result.currentEvidence === 'revalidated_current' ? copy.current : copy.changed}:{' '}
          {result.observedAt}
        </p>
      )}
    </div>
  )
}
