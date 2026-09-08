import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useAppStore } from '@/store'
import { getRuntimeEnvironmentRevision } from '@/runtime/runtime-environment-revision'
import { getKontextWorkbenchCopy } from './kontext-workbench-copy'
import { useKontextWorkbench } from './use-kontext-workbench'
import type { KontextRequestOwner } from './kontext-request-journal'
import { KontextOntologySetup } from './KontextOntologySetup'
import { KontextSourceRegistration } from './KontextSourceRegistration'
import { KontextTaskPlanner } from './KontextTaskPlanner'
import { KontextCompletionAssessment } from './KontextCompletionAssessment'
import { KontextTaskInventory } from './KontextTaskInventory'

export function KontextTaskWorkbench(): React.JSX.Element {
  useTranslation()
  const environmentId = useAppStore((state) => state.settings?.activeRuntimeEnvironmentId)
  const pairingRevision = environmentId ? getRuntimeEnvironmentRevision(environmentId) : undefined
  if (environmentId && pairingRevision === undefined) {
    return (
      <p role="status" className="mt-7 text-sm text-muted-foreground">
        {getKontextWorkbenchCopy().ownerMissing}
      </p>
    )
  }
  const owner: KontextRequestOwner =
    environmentId && pairingRevision !== undefined
      ? { kind: 'environment', environmentId, pairingRevision }
      : { kind: 'local' }
  return (
    <div key={JSON.stringify(owner)}>
      <KontextSourceRegistration owner={owner} />
      <KontextOntologySetup owner={owner} />
      <Workbench owner={owner} />
    </div>
  )
}

function Workbench({ owner }: { owner: KontextRequestOwner }): React.JSX.Element {
  const copy = getKontextWorkbenchCopy()
  const work = useKontextWorkbench(owner)
  const [taskId, setTaskId] = useState('')
  const [worktree, setWorktree] = useState('')
  const [provider, setProvider] = useState<'codex' | 'claude'>('codex')
  const [concurrency, setConcurrency] = useState('2')
  const [consent, setConsent] = useState(false)
  const task = work.task
  const entry = work.entry
  const job = entry?.job
  const busy = work.busy !== null
  const results = job?.result?.results ?? job?.progress?.results ?? []
  const statusLabel = (status: string) =>
    status in copy ? copy[status as keyof typeof copy] : status
  const canStart =
    !busy &&
    consent &&
    work.storageAvailable &&
    task?.taskId === taskId.trim() &&
    task?.status === 'current' &&
    task.contract &&
    task.logic.length > 0 &&
    worktree.trim().length > 0
  const canIntegrate =
    job?.status === 'completed' &&
    results.length > 0 &&
    results.every((result) => result.status === 'completed')

  return (
    <>
      <KontextTaskInventory
        owner={owner}
        disabled={busy}
        onSelect={(row) => {
          setTaskId(row.taskId)
          setWorktree(row.workspacePath)
          setConsent(false)
          void work.loadTask(row.taskId)
        }}
      />
      <KontextTaskPlanner
        owner={owner}
        onCreated={(id, workspace) => {
          setTaskId(id)
          setWorktree(workspace)
          setConsent(false)
          void work.loadTask(id)
        }}
      />
      <section
        className="mt-7 space-y-5 border-t border-border pt-6"
        aria-labelledby="kontext-task-heading"
      >
        <div>
          <h2 id="kontext-task-heading" className="text-sm font-medium">
            {copy.title}
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{copy.intro}</p>
        </div>
        <form
          className="flex items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            void work.loadTask(taskId.trim())
          }}
        >
          <div className="min-w-0 flex-1 space-y-2">
            <Label htmlFor="kontext-task-id">{copy.taskId}</Label>
            <Input
              id="kontext-task-id"
              value={taskId}
              disabled={busy}
              onChange={(event) => setTaskId(event.target.value)}
            />
          </div>
          <Button type="submit" variant="outline" disabled={busy || !taskId.trim()}>
            {copy.load}
          </Button>
        </form>
        {work.error && (
          <p role="alert" className="break-words text-sm text-destructive">
            {work.error}
          </p>
        )}
        {task && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-sm font-medium">{task.contract?.intent ?? task.taskId}</h3>
              <span className="shrink-0 text-xs text-muted-foreground">
                {statusLabel(task.status)}
              </span>
            </div>
            <dl className="grid gap-2 text-xs sm:grid-cols-[auto_minmax(0,1fr)]">
              <dt className="text-muted-foreground">{copy.revision}</dt>
              <dd className="break-all font-mono">{task.codeRevision}</dd>
              <dt className="text-muted-foreground">{copy.context}</dt>
              <dd className="break-all font-mono">{task.contextDigest ?? '—'}</dd>
              <dt className="text-muted-foreground">{copy.revisions}</dt>
              <dd>{task.normativeRevisionCount}</dd>
              <dt className="text-muted-foreground">{copy.evidence}</dt>
              <dd className="break-all font-mono">{task.requiredEvidenceIds.join(', ') || '—'}</dd>
            </dl>
            {task.contract && (
              <div>
                <h4 className="text-xs font-medium">{copy.acceptance}</h4>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
                  {task.contract.acceptance.map((criterion) => (
                    <li key={criterion.criterionId}>{criterion.statement}</li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <h4 className="text-xs font-medium">{copy.logic}</h4>
              <ul className="mt-2 divide-y divide-border">
                {task.logic.map((logic) => (
                  <li key={logic.workItemId} className="py-2 text-sm">
                    <span className="font-mono">{logic.workItemId}</span>
                    <p className="mt-1 break-all text-xs text-muted-foreground">
                      {logic.allowedPaths.join(', ')}
                    </p>
                  </li>
                ))}
              </ul>
              {task.logic.length === 0 && (
                <p className="text-xs text-muted-foreground">{copy.noLogic}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="kontext-worktree">{copy.worktree}</Label>
              <Input
                id="kontext-worktree"
                disabled={busy}
                value={worktree}
                onChange={(event) => setWorktree(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="space-y-2">
                <Label htmlFor="kontext-provider">{copy.provider}</Label>
                <Select
                  value={provider}
                  onValueChange={(value) => {
                    if (value === 'codex' || value === 'claude') {
                      setProvider(value)
                    }
                  }}
                  disabled={busy}
                >
                  <SelectTrigger id="kontext-provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="codex">Codex</SelectItem>
                    <SelectItem value="claude">Claude</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="kontext-concurrency">{copy.concurrency}</Label>
                <Select value={concurrency} onValueChange={setConcurrency} disabled={busy}>
                  <SelectTrigger id="kontext-concurrency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['1', '2', '3', '4'].map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
        <div className="flex items-start gap-2">
          <Checkbox
            id="kontext-execution-consent"
            checked={consent}
            onCheckedChange={(value) => setConsent(value === true)}
            disabled={busy}
          />
          <Label htmlFor="kontext-execution-consent" className="text-xs font-normal leading-5">
            {copy.consent}
          </Label>
        </div>
        {task && (
          <Button
            disabled={!canStart}
            onClick={() => {
              if (!task.contract) {
                return
              }
              void work.enqueue({
                taskId: task.taskId,
                worktree,
                maxConcurrency: Number(concurrency),
                maxRetries: 1,
                work: task.logic.map((logic) => ({
                  workItemId: logic.workItemId,
                  eligibleProviders: [provider],
                  prompt: `${task.contract?.intent}\nTask: ${task.taskId}\nLogic Work Item: ${logic.workItemId}\nImplement only the sidecar-planned symbols and paths. Use Kontext change verification and submit an accepted Change Bundle before finishing.`
                }))
              })
            }}
          >
            {copy.start}
          </Button>
        )}
        {work.entries.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="kontext-saved-request">{copy.saved}</Label>
            <Select
              value={entry?.request.requestId ?? ''}
              onValueChange={work.select}
              disabled={busy}
            >
              <SelectTrigger id="kontext-saved-request">
                <SelectValue placeholder={copy.select} />
              </SelectTrigger>
              <SelectContent>
                {work.entries.map((item) => (
                  <SelectItem key={item.request.requestId} value={item.request.requestId}>
                    {item.request.taskId} · {item.request.requestId.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {entry && (
          <div className="space-y-3 border-t border-border pt-4" aria-live="polite">
            <div className="flex flex-wrap gap-2 text-sm">
              <span>
                {statusLabel(entry.phase === 'accepted' && job ? job.status : entry.phase)}
              </span>
              <span className="break-all font-mono text-xs text-muted-foreground">
                {job?.jobId ?? entry.request.requestId}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {copy.lastObserved} {copy.taskIncomplete}
            </p>
            {job?.diagnostic && <p className="break-words text-xs">{job.diagnostic}</p>}
            {job?.resumeDiagnostic && <p className="break-words text-xs">{job.resumeDiagnostic}</p>}
            <ul className="divide-y divide-border">
              {results.map((result) => (
                <li key={result.workItemId} className="py-2 text-xs">
                  <div className="flex justify-between gap-3">
                    <span className="font-mono">{result.workItemId}</span>
                    <span>{statusLabel(result.status)}</span>
                  </div>
                  {result.diagnostics.map((diagnostic, index) => (
                    <p key={index} className="mt-1 text-muted-foreground">
                      {diagnostic}
                    </p>
                  ))}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              {entry.phase !== 'accepted' && (
                <Button
                  variant="outline"
                  disabled={busy || !consent}
                  onClick={() => void work.retry()}
                >
                  {copy.retry}
                </Button>
              )}
              <Button
                variant="outline"
                disabled={busy || !consent || !job}
                onClick={() => void work.refresh()}
              >
                {copy.refresh}
              </Button>
              <Button
                variant="ghost"
                disabled={busy || !job || ['cancelled', 'completed', 'failed'].includes(job.status)}
                onClick={() => void work.cancel()}
              >
                {copy.cancel}
              </Button>
              <Button
                variant="outline"
                disabled={busy || !consent || !canIntegrate}
                onClick={() => void work.integrate()}
              >
                {copy.integrate}
              </Button>
            </div>
            {canIntegrate && job && (
              <KontextCompletionAssessment
                key={`${JSON.stringify(owner)}:${job.taskId}:${job.jobId}:${work.integration?.state.resultRevision ?? ''}:${work.busy ?? ''}`}
                owner={owner}
                taskId={job.taskId}
                jobId={job.jobId}
                disabled={busy}
              />
            )}
          </div>
        )}
        {busy && (
          <p role="status" className="text-xs text-muted-foreground">
            {copy.busy}
          </p>
        )}
        {work.integration && (
          <div className="space-y-2 border-t border-border pt-4">
            <h3 className="text-sm font-medium">{copy.integration}</h3>
            <p className="break-all font-mono text-xs">{work.integration.state.workspacePath}</p>
            <p className="text-xs text-muted-foreground">{copy.integrationNotice}</p>
            <pre className="max-h-64 overflow-auto scrollbar-sleek whitespace-pre-wrap break-words text-xs">
              {JSON.stringify(
                {
                  executions: work.integration.executions,
                  review: work.integration.review,
                  reviewFindings: work.integration.reviewFindings
                },
                null,
                2
              )}
            </pre>
          </div>
        )}
      </section>
    </>
  )
}
