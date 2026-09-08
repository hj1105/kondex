import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import type { KontextRequestOwner } from './kontext-request-journal'
import { getKontextPlanningCopy } from './kontext-planning-copy'
import { useKontextPlanner } from './use-kontext-planner'
import { KontextPlanReview } from './KontextPlanReview'
import { KontextSourcePicker } from './KontextSourcePicker'
import { KontextPlanFeedback } from './KontextPlanFeedback'
import { KontextPlanRecovery } from './KontextPlanRecovery'

export function KontextTaskPlanner({
  owner,
  onCreated
}: {
  owner: KontextRequestOwner
  onCreated: (taskId: string, workspace: string) => void
}): React.JSX.Element {
  useTranslation()
  const copy = getKontextPlanningCopy()
  const work = useKontextPlanner(owner, onCreated)
  const [goal, setGoal] = useState('')
  const [workspace, setWorkspace] = useState('')
  const [sources, setSources] = useState('')
  const [provider, setProvider] = useState<'codex' | 'claude'>('codex')
  const [consent, setConsent] = useState(false)
  const [approval, setApproval] = useState<string | null>(null)
  const plan = work.plan
  const refinement = plan?.refinement ?? work.entry?.refinementRequest
  const { busy, inspect } = work
  useEffect(() => {
    if (plan?.status !== 'planning' || busy) {
      return
    }
    const timer = window.setTimeout(() => void inspect(), 2_000)
    return () => window.clearTimeout(timer)
  }, [plan, busy, inspect])
  const disabled = work.busy || Boolean(work.entry)
  return (
    <section
      className="mt-7 space-y-4 border-t border-border pt-6"
      aria-labelledby="kontext-planner-heading"
    >
      <div>
        <h2 id="kontext-planner-heading" className="text-sm font-medium">
          {copy.title}
        </h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{copy.intro}</p>
      </div>
      {!work.entry && (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            setApproval(null)
            if (consent) {
              setConsent(false)
              void work.start({
                goal,
                workspace,
                provider,
                sourceResourceIds: sources
                  .split('\n')
                  .map((value) => value.trim())
                  .filter(Boolean)
              })
            }
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="kontext-plan-goal">{copy.goal}</Label>
            <Textarea
              id="kontext-plan-goal"
              value={goal}
              disabled={disabled}
              onChange={(event) => {
                setGoal(event.target.value)
                setConsent(false)
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kontext-plan-workspace">{copy.workspace}</Label>
            <Input
              id="kontext-plan-workspace"
              value={workspace}
              disabled={disabled}
              onChange={(event) => {
                setWorkspace(event.target.value)
                setConsent(false)
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kontext-plan-sources">{copy.sources}</Label>
            <KontextSourcePicker
              owner={owner}
              provider={provider}
              disabled={disabled}
              selected={sources
                .split('\n')
                .map((value) => value.trim())
                .filter(Boolean)}
              onChange={(ids) => {
                setSources(ids.join('\n'))
                setConsent(false)
              }}
            />
            <Textarea
              id="kontext-plan-sources"
              value={sources}
              disabled={disabled}
              onChange={(event) => {
                setSources(event.target.value)
                setConsent(false)
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kontext-plan-provider">{copy.provider}</Label>
            <Select
              value={provider}
              disabled={disabled}
              onValueChange={(value) => {
                if (value === 'codex' || value === 'claude') {
                  setProvider(value)
                  setConsent(false)
                }
              }}
            >
              <SelectTrigger id="kontext-plan-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="codex">Codex</SelectItem>
                <SelectItem value="claude">Claude</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">{copy.scope}</p>
          <div className="flex items-start gap-2">
            <Checkbox
              id="kontext-plan-consent"
              checked={consent}
              disabled={disabled}
              onCheckedChange={(value) => setConsent(value === true)}
            />
            <Label htmlFor="kontext-plan-consent" className="text-xs font-normal leading-5">
              {copy.consent}
            </Label>
          </div>
          <Button
            type="submit"
            disabled={
              disabled || !work.storageAvailable || !consent || !goal.trim() || !workspace.trim()
            }
          >
            {copy.start}
          </Button>
        </form>
      )}
      {work.entries.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="kontext-plan-saved">{copy.saved}</Label>
          <Select
            value={work.entry?.requestId ?? ''}
            disabled={work.busy}
            onValueChange={(id) => {
              work.select(id)
              setApproval(null)
            }}
          >
            <SelectTrigger id="kontext-plan-saved">
              <SelectValue placeholder={copy.saved} />
            </SelectTrigger>
            <SelectContent>
              {work.entries.map((entry) => (
                <SelectItem key={entry.requestId} value={entry.requestId}>
                  {entry.workspace} · {entry.requestId.slice(0, 8)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {work.entry && (
        <div className="space-y-3" aria-live="polite">
          <p className="break-all font-mono text-xs">{work.entry.requestId}</p>
          <p className="text-sm">{plan ? copy[plan.status] : copy.unknown}</p>
          {!plan && (
            <KontextPlanRecovery
              key={work.entry.requestId}
              entry={work.entry}
              busy={work.busy}
              onRecover={() => {
                setApproval(null)
                void work.recover()
              }}
            />
          )}
          {refinement && (
            <div className="space-y-1 text-xs">
              <p>{copy.parentPlan}</p>
              <p className="break-all font-mono">
                {refinement.parentRequestId} · {refinement.expectedParentDigest}
              </p>
              <p className="whitespace-pre-wrap break-words">{refinement.feedback}</p>
            </div>
          )}
          {plan && (
            <p className="text-sm">
              {plan.request.goal} · {plan.request.provider}
            </p>
          )}
          {plan?.diagnostic && (
            <p className="break-words text-xs text-muted-foreground">{plan.diagnostic}</p>
          )}
          {plan && <KontextPlanReview plan={plan} />}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={work.busy}
              onClick={() => {
                setApproval(null)
                void work.inspect()
              }}
            >
              {copy.inspect}
            </Button>
            {plan?.status === 'planning' && (
              <Button variant="ghost" disabled={work.busy} onClick={() => void work.cancel()}>
                {copy.cancel}
              </Button>
            )}
            {plan && !['planning', 'unverifiable'].includes(plan.status) && (
              <Button
                variant="ghost"
                disabled={work.busy}
                onClick={() => {
                  work.newPlan()
                  setConsent(false)
                  setApproval(null)
                }}
              >
                {copy.newPlan}
              </Button>
            )}
            {plan?.status === 'approved' && (
              <Button variant="outline" disabled={work.busy} onClick={() => work.open()}>
                {copy.open}
              </Button>
            )}
          </div>
          {plan?.status === 'review' && plan.planDigest && (
            <div className="space-y-3">
              <KontextPlanFeedback
                key={`${plan.request.requestId}:${plan.planDigest}`}
                disabled={work.busy || !work.storageAvailable}
                onRefine={(feedback) => {
                  setApproval(null)
                  void work.refine(feedback)
                }}
              />
              <div className="flex items-start gap-2">
                <Checkbox
                  id="kontext-plan-approval"
                  checked={approval === plan.planDigest}
                  disabled={work.busy}
                  onCheckedChange={(value) =>
                    setApproval(value === true ? (plan.planDigest ?? null) : null)
                  }
                />
                <Label htmlFor="kontext-plan-approval" className="text-xs font-normal leading-5">
                  {copy.approval}
                </Label>
              </div>
              <Button
                disabled={work.busy || approval !== plan.planDigest}
                onClick={() => {
                  setApproval(null)
                  void work.approve()
                }}
              >
                {copy.approve}
              </Button>
            </div>
          )}
        </div>
      )}
      {work.error && (
        <p role="alert" className="text-sm text-destructive">
          {copy[work.error]}
        </p>
      )}
      {work.busy && (
        <p role="status" className="text-xs text-muted-foreground">
          {copy.busy}
        </p>
      )}
    </section>
  )
}
