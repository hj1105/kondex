import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import { getRuntimeEnvironmentRevision } from '@/runtime/runtime-environment-revision'
import {
  kontextRegisteredIntegrationSchema,
  type KontextRegisteredIntegration as Observation
} from '../../../../shared/kontext-registered-integration-contract'
import type { KontextRequestOwner } from './kontext-request-journal'
import { getKontextRegisteredIntegrationCopy } from './kontext-registered-integration-copy'
import { getKontextRegisteredScheduleCopy } from './kontext-registered-schedule-copy'
import { getKontextCompletionCopy } from './kontext-completion-copy'
import { KontextCompletionAssessment } from './KontextCompletionAssessment'

export function KontextRegisteredIntegration({
  owner,
  taskId,
  jobId,
  disabled
}: {
  owner: KontextRequestOwner
  taskId: string
  jobId: string
  disabled: boolean
}) {
  useTranslation()
  const copy = getKontextRegisteredIntegrationCopy()
  const [result, setResult] = useState<Observation | null>(null)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(false)
  const [failed, setFailed] = useState(false)
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
  const selectedIntegration = result?.integration?.scheduleJobId === jobId
  function assertOwner() {
    if (
      !alive.current ||
      (owner.kind === 'environment' &&
        getRuntimeEnvironmentRevision(owner.environmentId) !== owner.pairingRevision)
    ) {
      throw new Error('Integration owning runtime changed')
    }
  }
  async function run(integrate: boolean) {
    if (
      disabled ||
      running.current ||
      (integrate && (!consent || !result?.canRequestIntegration || selectedIntegration))
    ) {
      return
    }
    const previous = result
    running.current = true
    setBusy(true)
    setResult(null)
    setConsent(false)
    setFailed(false)
    try {
      assertOwner()
      const response = kontextRegisteredIntegrationSchema.parse(
        await callRuntimeRpc<unknown>(
          owner,
          integrate
            ? 'kontext.integrateRegisteredSchedule'
            : 'kontext.inspectRegisteredIntegration',
          {
            taskId,
            jobId,
            ...(integrate
              ? {
                  expectedJobIdentityDigest: previous?.jobIdentityDigest,
                  expectedIntegrationDigest: previous?.integrationDigest,
                  allowSubscriptionExecution: true
                }
              : {})
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
        response.taskId !== taskId ||
        response.jobId !== jobId ||
        response.command !== (integrate ? 'integrate' : undefined) ||
        (integrate && response.jobIdentityDigest !== previous?.jobIdentityDigest)
      ) {
        throw new Error('Integration identity mismatch')
      }
      setResult(response)
    } catch {
      if (alive.current) {
        setFailed(true)
      }
    } finally {
      running.current = false
      if (alive.current) {
        setBusy(false)
      }
    }
  }
  return (
    <section aria-label={copy.title} className="space-y-3 border-t border-border pt-4">
      <h3 className="text-sm font-medium">{copy.title}</h3>
      <p className="text-xs leading-5 text-muted-foreground">{copy.notice}</p>
      <Button variant="outline" disabled={disabled || busy} onClick={() => void run(false)}>
        {copy.inspect}
      </Button>
      {progress && (
        <p role="status" className="text-xs text-muted-foreground">
          {getKontextRegisteredScheduleCopy().busy}
        </p>
      )}
      {failed && (
        <p role="alert" className="text-xs text-destructive">
          {copy.error}
        </p>
      )}
      {result && (
        <>
          {!result.integration ? (
            <p className="text-xs text-muted-foreground">{copy.none}</p>
          ) : (
            <>
              {!selectedIntegration && (
                <p className="text-xs text-muted-foreground">{copy.other}</p>
              )}
              <p className="break-all font-mono text-xs">
                {result.integration.scheduleJobId} · {result.integration.workspacePath}
              </p>
              <dl className="grid gap-x-3 gap-y-1 text-xs sm:grid-cols-[auto_minmax(0,1fr)]">
                <dt className="text-muted-foreground">{getKontextCompletionCopy().commit}</dt>
                <dd className="break-all font-mono">{result.integration.gitCommit}</dd>
                <dt className="text-muted-foreground">{copy.recorded}</dt>
                <dd>{result.integration.createdAt}</dd>
              </dl>
            </>
          )}
          {!selectedIntegration && (
            <>
              <div className="flex items-start gap-2">
                <Checkbox
                  id="kontext-host-integration-consent"
                  checked={consent}
                  disabled={disabled || busy || !result.canRequestIntegration}
                  onCheckedChange={(checked) => setConsent(checked === true)}
                />
                <Label
                  htmlFor="kontext-host-integration-consent"
                  className="text-xs font-normal leading-5"
                >
                  {copy.consent}
                </Label>
              </div>
              <Button
                variant="outline"
                disabled={disabled || busy || !consent || !result.canRequestIntegration}
                onClick={() => void run(true)}
              >
                {copy.integrate}
              </Button>
            </>
          )}
          {selectedIntegration && (
            <KontextCompletionAssessment
              key={result.integrationDigest}
              owner={owner}
              taskId={taskId}
              jobId={jobId}
              disabled={disabled || busy}
            />
          )}
        </>
      )}
    </section>
  )
}
