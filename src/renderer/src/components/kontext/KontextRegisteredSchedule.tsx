import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import { getRuntimeEnvironmentRevision } from '@/runtime/runtime-environment-revision'
import {
  kontextRegisteredScheduleSchema,
  type KontextRegisteredSchedule
} from '../../../../shared/kontext-registered-schedule-contract'
import type { KontextRequestOwner } from './kontext-request-journal'
import { getKontextRegisteredScheduleCopy } from './kontext-registered-schedule-copy'
import { getKontextWorkbenchCopy } from './kontext-workbench-copy'
import { KontextRegisteredIntegration } from './KontextRegisteredIntegration'

export function KontextRegisteredSchedule({
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
  const copy = getKontextRegisteredScheduleCopy()
  const [snapshot, setSnapshot] = useState<KontextRegisteredSchedule | null>(null)
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
  const actionable =
    snapshot &&
    !snapshot.job.cancellationRequestedAt &&
    !['completed', 'failed', 'cancelled'].includes(snapshot.job.status)
  function assertOwner() {
    if (
      !alive.current ||
      (owner.kind === 'environment' &&
        getRuntimeEnvironmentRevision(owner.environmentId) !== owner.pairingRevision)
    ) {
      throw new Error('Owning runtime changed')
    }
  }
  async function run(action: 'inspect' | 'resume' | 'cancel') {
    if (
      disabled ||
      running.current ||
      (action !== 'inspect' && (!actionable || (action === 'resume' && !consent)))
    ) {
      return
    }
    running.current = true
    const previous = snapshot
    setBusy(true)
    setFailed(false)
    setSnapshot(null)
    setConsent(false)
    try {
      assertOwner()
      const result = kontextRegisteredScheduleSchema.parse(
        await callRuntimeRpc<unknown>(
          owner,
          `kontext.${action}RegisteredSchedule`,
          {
            taskId,
            jobId,
            ...(action !== 'inspect'
              ? { expectedJobIdentityDigest: previous?.jobIdentityDigest }
              : {}),
            ...(action === 'resume' ? { allowSubscriptionExecution: true } : {})
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
        result.job.taskId !== taskId ||
        result.job.jobId !== jobId ||
        result.command?.action !== (action === 'inspect' ? undefined : action) ||
        (action !== 'inspect' && result.jobIdentityDigest !== previous?.jobIdentityDigest)
      ) {
        throw new Error('Schedule identity mismatch')
      }
      setSnapshot(result)
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
    <section
      className="space-y-3 border-t border-border pt-4"
      aria-labelledby="kontext-registered-schedule-heading"
    >
      <h3 id="kontext-registered-schedule-heading" className="text-sm font-medium">
        {copy.title}
      </h3>
      <p className="break-all font-mono text-xs text-muted-foreground">{jobId}</p>
      <p className="text-xs leading-5 text-muted-foreground">{copy.notice}</p>
      <Button variant="outline" disabled={disabled || busy} onClick={() => void run('inspect')}>
        {copy.inspect}
      </Button>
      {progress && (
        <p role="status" className="text-xs text-muted-foreground">
          {copy.busy}
        </p>
      )}
      {failed && (
        <p role="alert" className="text-xs text-destructive">
          {copy.error}
        </p>
      )}
      {snapshot && (
        <>
          <dl className="grid gap-x-3 gap-y-1 text-xs sm:grid-cols-[auto_minmax(0,1fr)]">
            <dt className="text-muted-foreground">{copy.status}</dt>
            <dd>{getKontextWorkbenchCopy()[snapshot.job.status]}</dd>
            <dt className="text-muted-foreground">{copy.cancellation}</dt>
            <dd>{snapshot.job.cancellationRequestedAt ?? '—'}</dd>
            <dt className="text-muted-foreground">{copy.resumes}</dt>
            <dd>{snapshot.job.resumeCount}</dd>
          </dl>
          <ul className="space-y-2 text-xs">
            {snapshot.workItems.map((work) => (
              <li key={work.workItemId}>
                <span className="break-all font-mono">{work.workItemId}</span> ·{' '}
                {work.pinnedProvider ?? work.eligibleProviders.join(', ')}
                <p className="text-muted-foreground">
                  {copy.result}: {work.result ? getKontextWorkbenchCopy()[work.result.status] : '—'}
                </p>
              </li>
            ))}
          </ul>
          {snapshot.command && (
            <p role="status" className="text-xs">
              {snapshot.command.resumeBlocked ? copy.blocked : copy.returned}
            </p>
          )}
          <div className="flex items-start gap-2">
            <Checkbox
              id="kontext-host-schedule-consent"
              checked={consent}
              disabled={disabled || busy || !actionable}
              onCheckedChange={(value) => setConsent(value === true)}
            />
            <Label
              htmlFor="kontext-host-schedule-consent"
              className="text-xs font-normal leading-5"
            >
              {copy.consent}
            </Label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={disabled || busy || !actionable || !consent}
              onClick={() => void run('resume')}
            >
              {copy.resume}
            </Button>
            <Button
              variant="ghost"
              disabled={disabled || busy || !actionable}
              onClick={() => void run('cancel')}
            >
              {copy.cancel}
            </Button>
          </div>
          {snapshot.job.status === 'completed' && (
            <KontextRegisteredIntegration
              key={`${JSON.stringify(owner)}:${taskId}:${jobId}`}
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
