import type { KontextPlanView } from '../../../../shared/kontext-planning-contract'
import { getKontextPlanningCopy } from './kontext-planning-copy'
import { getKontextWorkbenchCopy } from './kontext-workbench-copy'

export function KontextPlanReview({ plan }: { plan: KontextPlanView }): React.JSX.Element | null {
  const proposal = plan.proposal
  if (!proposal) {
    return null
  }
  const copy = getKontextPlanningCopy()
  const work = getKontextWorkbenchCopy()
  return (
    <div className="space-y-4" data-testid="kontext-plan-review">
      <h3 className="text-sm font-medium">{proposal.contract.intent}</h3>
      <dl className="grid gap-2 text-xs sm:grid-cols-[auto_minmax(0,1fr)]">
        <dt className="text-muted-foreground">{work.revision}</dt>
        <dd className="break-all font-mono">{plan.codeRevision}</dd>
        <dt className="text-muted-foreground">{work.context}</dt>
        <dd className="break-all font-mono">{plan.contextDigest}</dd>
        <dt className="text-muted-foreground">{copy.risk}</dt>
        <dd>{proposal.contract.risk}</dd>
        <dt className="text-muted-foreground">{copy.targets}</dt>
        <dd className="break-all">{proposal.contract.targets.join(', ')}</dd>
        <dt className="text-muted-foreground">{work.evidence}</dt>
        <dd className="break-all font-mono">{plan.evidenceIds?.join(', ') || '—'}</dd>
      </dl>
      <div>
        <h4 className="text-xs font-medium">{work.acceptance}</h4>
        <ul className="mt-2 list-disc space-y-2 pl-4 text-sm">
          {proposal.contract.acceptance.map((item) => (
            <li key={item.criterionId}>
              {item.statement}
              <p className="break-all font-mono text-xs text-muted-foreground">
                {item.criterionId} · {item.verifier.kind}: {item.verifier.ref}
              </p>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h4 className="text-xs font-medium">{copy.nonGoals}</h4>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
          {proposal.contract.nonGoals.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </div>
      <div>
        <h4 className="text-xs font-medium">{work.logic}</h4>
        <ul className="mt-2 divide-y divide-border">
          {proposal.logicPlans.map((logic) => (
            <li key={logic.workItemId} className="space-y-2 py-3 text-sm">
              <p className="font-mono">{logic.workItemId}</p>
              <p className="break-all font-mono text-xs">{logic.allowedPaths.join(', ')}</p>
              <ul className="space-y-2">
                {logic.plannedSymbols.map((symbol) => (
                  <li key={symbol.plannedSymbolId}>
                    <p>{symbol.responsibility}</p>
                    <p className="break-all font-mono text-xs text-muted-foreground">
                      {symbol.plannedSymbolId} ·{' '}
                      {Object.entries(symbol.intendedIdentity)
                        .map(([key, value]) => `${key}: ${value}`)
                        .join(' · ')}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                {copy.dependencies}: {logic.dependsOn?.join(', ') || '—'}
              </p>
              <p className="break-all font-mono text-xs text-muted-foreground">
                {copy.verifiers}:{' '}
                {logic.requiredVerifiers?.map((item) => `${item.kind}: ${item.ref}`).join(', ') ||
                  '—'}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
