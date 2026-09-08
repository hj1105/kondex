import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  kontextCompletionAssessmentSchema,
  type KontextCompletionAssessment as Assessment
} from '../../../../shared/kontext-completion-contract'
import { Button } from '@/components/ui/button'
import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import { getRuntimeEnvironmentRevision } from '@/runtime/runtime-environment-revision'
import type { KontextRequestOwner } from './kontext-request-journal'
import { getKontextCompletionCopy } from './kontext-completion-copy'
import { KontextTaskFinalization } from './KontextTaskFinalization'

export function KontextCompletionAssessment({
  owner,
  taskId,
  jobId,
  disabled
}: {
  owner: KontextRequestOwner
  taskId: string
  jobId: string
  disabled: boolean
}): React.JSX.Element {
  useTranslation()
  const copy = getKontextCompletionCopy()
  const [result, setResult] = useState<Assessment | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const inFlight = useRef(false)
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
  async function assess() {
    if (inFlight.current || disabled) {
      return
    }
    inFlight.current = true
    setBusy(true)
    setResult(null)
    setError(false)
    try {
      assertOwner()
      const response = await callRuntimeRpc<unknown>(
        owner,
        'kontext.assessCompletion',
        { taskId, jobId },
        {
          expectedEnvironmentPairingRevision:
            owner.kind === 'environment' ? owner.pairingRevision : undefined,
          timeoutMs: 60_000
        }
      )
      assertOwner()
      const value = kontextCompletionAssessmentSchema.parse(response)
      if (value.taskId !== taskId || value.jobId !== jobId) {
        throw new Error('Completion identity mismatch')
      }
      setResult(value)
    } catch {
      if (alive.current) {
        setError(true)
      }
    } finally {
      inFlight.current = false
      if (alive.current) {
        setBusy(false)
      }
    }
  }
  return (
    <section aria-label={copy.title} className="space-y-3 border-t border-border pt-4">
      <h3 className="text-sm font-medium">{copy.title}</h3>
      <p className="text-xs leading-5 text-muted-foreground">{copy.notice}</p>
      <Button variant="outline" disabled={disabled || busy} onClick={() => void assess()}>
        {copy.assess}
      </Button>
      {busy && (
        <p role="status" className="text-xs text-muted-foreground">
          {copy.busy}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {copy.error}
        </p>
      )}
      {result && (
        <div className="space-y-3" aria-live="polite">
          <p className="text-sm font-medium">{copy[result.state]}</p>
          <p className="text-xs text-muted-foreground">
            {copy.observed}: {result.observedAt}
          </p>
          <dl className="grid gap-2 text-xs sm:grid-cols-[auto_minmax(0,1fr)]">
            <dt>{copy.commit}</dt>
            <dd className="break-all font-mono">{result.gitCommit}</dd>
            <dt>{copy.context}</dt>
            <dd className="break-all font-mono">
              {result.context.contextDigest} · {result.context.status}
            </dd>
          </dl>
          {result.issues.length > 0 && (
            <ul className="list-disc space-y-1 pl-4 text-xs">
              {result.issues.map((issue, index) => (
                <li key={index}>
                  {issue.message}
                  {issue.ref ? ` (${issue.ref})` : ''}
                </li>
              ))}
            </ul>
          )}
          <h4 className="text-xs font-medium">{copy.verification}</h4>
          <ul className="space-y-1 text-xs">
            {result.verificationRuns.map((run) => (
              <li key={run.verificationRunId} className="break-all">
                {run.tier} · {run.verifierKind} · {run.verifierRef} · {run.result}
              </li>
            ))}
          </ul>
          <details className="text-xs">
            <summary className="cursor-pointer">{copy.evidence}</summary>
            <pre className="mt-2 max-h-64 overflow-auto scrollbar-sleek whitespace-pre-wrap break-words">
              {JSON.stringify(
                {
                  invariantEvaluations: result.invariantEvaluations,
                  accuracyManifest: result.accuracyManifest ?? null,
                  accuracyManifestError: result.accuracyManifestError ?? null
                },
                null,
                2
              )}
            </pre>
          </details>
        </div>
      )}
      <KontextTaskFinalization
        key={result?.completionBasisDigest ?? 'unassessed'}
        owner={owner}
        taskId={taskId}
        jobId={jobId}
        basis={result?.completionBasisDigest}
        ready={result?.state === 'done'}
        disabled={disabled || busy}
      />
    </section>
  )
}
