import type {
  KontextOntologyCheckResult,
  KontextOntologySource
} from '../../../../shared/kontext-ontology-contract'
import { getKontextOntologyCopy } from './kontext-ontology-copy'

/**
 * The configured sources with whatever the last check learned about each. Read
 * before acting, so the panel does not require running a command to find out
 * what is already connected.
 */
export function KontextOntologySourceList({
  sources,
  checks
}: {
  sources: readonly KontextOntologySource[]
  checks: KontextOntologyCheckResult['sources'] | null
}): React.JSX.Element {
  const copy = getKontextOntologyCopy()
  if (sources.length === 0) {
    return (
      <p role="status" className="mt-2 text-sm text-muted-foreground">
        {copy.noSources}
      </p>
    )
  }
  const checkByName = new Map((checks ?? []).map((entry) => [entry.name, entry]))
  return (
    <ul className="mt-2 flex flex-col gap-1.5">
      {sources.map((source) => {
        const check = checkByName.get(source.name)
        return (
          <li
            key={source.name}
            className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-md border border-border bg-muted/30 px-2.5 py-1.5"
          >
            <span className="text-sm font-medium text-foreground">{source.name}</span>
            <span className="text-xs text-muted-foreground">{source.transport}</span>
            {source.code === true && (
              <span className="rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">
                {copy.codeBadge}
              </span>
            )}
            {source.type !== null && (
              <span className="rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">
                {source.type}
              </span>
            )}
            {check !== undefined &&
              (check.ok ? (
                <span className="text-xs text-muted-foreground">
                  {copy.resourceCount(check.resourceCount ?? 0)}
                </span>
              ) : (
                <span className="text-xs text-destructive">{check.error ?? copy.checkFailed}</span>
              ))}
            <span className="w-full truncate text-xs text-muted-foreground" title={source.target}>
              {source.target}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
