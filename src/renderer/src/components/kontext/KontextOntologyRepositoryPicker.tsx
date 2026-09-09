import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type {
  KontextGithubRepository,
  KontextOntologyRepositoriesResult
} from '../../../../shared/kontext-ontology-contract'
import { getKontextOntologyCopy } from './kontext-ontology-copy'
import type { AddSourceInput } from './use-kontext-ontology'

/**
 * The checklist behind the organization preset: every repository the user's gh
 * login can see, working ones ticked by default, each ticked one added as its
 * own git source. Adding runs one repository at a time so a failure names the
 * repository it belongs to instead of aborting the list halfway.
 */

/** `owner-repo`, restricted to characters every YAML key and file name accepts. */
export function repositorySourceName(owner: string, repository: string): string {
  return `${owner}-${repository}`.replace(/[^A-Za-z0-9_.-]+/g, '-')
}

/** Ticked by default: the repositories a team is working in, not its archive or mirrors. */
function defaultSelection(repositories: readonly KontextGithubRepository[]): Set<string> {
  return new Set(
    repositories
      .filter((repository) => !repository.archived && !repository.fork)
      .map((repository) => repository.fullName)
  )
}

type AddProgress = {
  readonly done: number
  readonly total: number
  readonly failed: readonly string[]
}

function Badge({ children }: { children: string }): React.JSX.Element {
  return (
    <span className="rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">
      {children}
    </span>
  )
}

export function KontextOntologyRepositoryPicker({
  listing,
  disabled,
  readCode,
  onAdd,
  onAllAdded
}: {
  listing: KontextOntologyRepositoriesResult
  disabled: boolean
  /** Adds each source with `code: true`, so its files join the code ontology. */
  readCode: boolean
  onAdd: (input: AddSourceInput) => Promise<boolean>
  /** Every chosen repository was added; the dialog can close. */
  onAllAdded: () => void
}): React.JSX.Element {
  const copy = getKontextOntologyCopy()
  const [selected, setSelected] = useState<Set<string>>(() =>
    defaultSelection(listing.repositories)
  )
  const [includeArchived, setIncludeArchived] = useState(false)
  const [includeForks, setIncludeForks] = useState(false)
  const [progress, setProgress] = useState<AddProgress | null>(null)

  const visible = listing.repositories.filter(
    (repository) => (includeArchived || !repository.archived) && (includeForks || !repository.fork)
  )
  const chosen = visible.filter((repository) => selected.has(repository.fullName))

  const toggle = (fullName: string, on: boolean): void => {
    setSelected((previous) => {
      const next = new Set(previous)
      if (on) {
        next.add(fullName)
      } else {
        next.delete(fullName)
      }
      return next
    })
  }

  const addSelected = async (): Promise<void> => {
    const failed: string[] = []
    let done = 0
    setProgress({ done, total: chosen.length, failed })
    for (const repository of chosen) {
      const added = await onAdd({
        name: repositorySourceName(listing.owner, repository.name),
        transport: 'git',
        url: repository.cloneUrl,
        ...(readCode ? { code: true } : {})
      })
      if (!added) {
        failed.push(repository.fullName)
      }
      done += 1
      setProgress({ done, total: chosen.length, failed: [...failed] })
    }
    if (failed.length === 0) {
      onAllAdded()
    }
  }

  return (
    <div className="flex flex-col gap-1.5" role="group" aria-label={copy.presetGithubOrg}>
      <p role="status" className="text-xs text-muted-foreground">
        {listing.repositories.length === 0
          ? copy.noRepositories
          : copy.repositoriesFound(listing.repositories.length, listing.owner)}
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground">
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(event) => setIncludeArchived(event.target.checked)}
            disabled={disabled}
          />
          {copy.includeArchived}
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={includeForks}
            onChange={(event) => setIncludeForks(event.target.checked)}
            disabled={disabled}
          />
          {copy.includeForks}
        </label>
        <Button
          variant="ghost"
          className="h-6 px-1.5 text-xs"
          onClick={() => setSelected(new Set(visible.map((entry) => entry.fullName)))}
          disabled={disabled}
        >
          {copy.selectAll}
        </Button>
        <Button
          variant="ghost"
          className="h-6 px-1.5 text-xs"
          onClick={() => setSelected(new Set())}
          disabled={disabled}
        >
          {copy.selectNone}
        </Button>
      </div>
      <ul className="scrollbar-sleek max-h-64 overflow-y-auto rounded-md border border-border">
        {visible.map((repository) => (
          <li key={repository.fullName} className="border-b border-border last:border-b-0">
            <label className="flex items-center gap-2 px-2 py-1 text-sm text-foreground">
              <input
                type="checkbox"
                checked={selected.has(repository.fullName)}
                onChange={(event) => toggle(repository.fullName, event.target.checked)}
                disabled={disabled}
                aria-label={repository.fullName}
              />
              <span className="font-medium">{repository.name}</span>
              {repository.language !== null && (
                <span className="text-xs text-muted-foreground">{repository.language}</span>
              )}
              {repository.private && <Badge>{copy.repositoryPrivate}</Badge>}
              {repository.archived && <Badge>{copy.repositoryArchived}</Badge>}
              {repository.fork && <Badge>{copy.repositoryFork}</Badge>}
            </label>
          </li>
        ))}
      </ul>
      {progress !== null && (
        <p role="status" className="text-xs text-muted-foreground">
          {copy.addProgress(progress.done, progress.total)}
          {progress.failed.length > 0 && ` ${copy.addFailed(progress.failed.join(', '))}`}
        </p>
      )}
      <div>
        <Button onClick={() => void addSelected()} disabled={disabled || chosen.length === 0}>
          {copy.addSelected(chosen.length)}
        </Button>
      </div>
    </div>
  )
}
