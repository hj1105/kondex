import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAppStore } from '../../store'
import { KontextOntologyAddSource } from './KontextOntologyAddSource'
import { getKontextOntologyCopy } from './kontext-ontology-copy'
import { KontextOntologySourceList } from './KontextOntologySourceList'
import type { KontextRequestOwner } from './kontext-request-journal'
import { type OntologyAction, useKontextOntology } from './use-kontext-ontology'

function parseTargetNodes(raw: string): number | 'empty' | 'invalid' {
  const text = raw.trim()
  if (text === '') {
    return 'empty'
  }
  if (!/^\d+$/.test(text)) {
    return 'invalid'
  }
  const value = Number(text)
  return value >= 3 && value <= 200 ? value : 'invalid'
}

function Step({
  index,
  title,
  children
}: {
  index: number
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="mt-4">
      <h4 className="text-sm font-medium text-foreground">
        <span className="mr-1.5 text-muted-foreground">{index}</span>
        {title}
      </h4>
      {children}
    </div>
  )
}

export function KontextOntologySetup({ owner }: { owner: KontextRequestOwner }): React.JSX.Element {
  useTranslation()
  const copy = getKontextOntologyCopy()
  const worktreesByRepo = useAppStore((s) => s.worktreesByRepo)
  const folderWorkspaces = useAppStore((s) => s.folderWorkspaces)
  const workspaces = useMemo(() => {
    // Why: the slice is absent until the store hydrates, and a panel that throws
    // there takes the whole Kontext page down with it.
    const worktreeRows = Object.values(worktreesByRepo ?? {})
      .flat()
      .filter((worktree) => worktree !== null && worktree !== undefined)
      .map((worktree) => ({
        id: worktree.id,
        title: worktree.displayName,
        directory: worktree.id.split('::').slice(1).join('::')
      }))
    // Why: a folder workspace is a workspace too — its kontext.yaml lives in the
    // folder — and the host resolves it through the `folder:` selector.
    const folderRows = (folderWorkspaces ?? [])
      .filter((workspace) => !workspace.isArchived)
      .map((workspace) => ({
        id: `folder:${workspace.id}`,
        title: workspace.name,
        directory: workspace.folderPath
      }))
    const rows = [...worktreeRows, ...folderRows]
    // Why: two workspaces can share a display name, and identical options are
    // unpickable — the directory is what tells them apart.
    const seen = new Map<string, number>()
    for (const row of rows) {
      seen.set(row.title, (seen.get(row.title) ?? 0) + 1)
    }
    return rows.map((row) => {
      if ((seen.get(row.title) ?? 0) < 2) {
        return { id: row.id, title: row.title }
      }
      const directory = row.directory.split(/[\\/]/).findLast((segment) => segment !== '')
      return { id: row.id, title: directory ? `${row.title} — ${directory}` : row.title }
    })
  }, [worktreesByRepo, folderWorkspaces])

  const [workspace, setWorkspace] = useState('')
  const [includeMarkdown, setIncludeMarkdown] = useState(true)
  const [targetNodes, setTargetNodes] = useState('')
  const [nodeCountError, setNodeCountError] = useState<string | null>(null)
  const ontology = useKontextOntology(owner, workspace)
  // Why: an error shown at the foot of the section went unread; each step's failure
  // belongs beside the button that produced it.
  const errorFor = (...actions: OntologyAction[]): React.JSX.Element | null =>
    ontology.state.error !== null &&
    ontology.state.errorAction !== null &&
    actions.includes(ontology.state.errorAction) ? (
      <p role="alert" className="mt-2 text-sm text-destructive">
        {ontology.state.error}
      </p>
    ) : null
  const { state, refresh, reset } = ontology

  // Choosing a workspace is enough to show what it already has; nothing is written.
  useEffect(() => {
    if (workspace === '') {
      reset()
      return
    }
    void refresh()
  }, [workspace, refresh, reset])

  const busy = state.busy !== null
  const hasSources = (state.sources?.length ?? 0) > 0
  const checksPassed =
    state.checks !== null && state.checks.length > 0 && state.checks.every((entry) => entry.ok)

  const runSetup = (apply: boolean): void => {
    const nodes = parseTargetNodes(targetNodes)
    if (nodes === 'invalid') {
      setNodeCountError(copy.invalidTargetNodes)
      return
    }
    setNodeCountError(null)
    void ontology.setup(nodes === 'empty' ? undefined : nodes, apply)
  }

  return (
    <section className="mt-6" aria-labelledby="kontext-ontology-title">
      <h3 id="kontext-ontology-title" className="text-sm font-semibold text-foreground">
        {copy.title}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">{copy.intro}</p>

      <Step index={1} title={copy.stepWorkspace}>
        <select
          aria-label={copy.workspace}
          className="mt-1.5 h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground"
          value={workspace}
          onChange={(event) => setWorkspace(event.target.value)}
          disabled={busy}
        >
          <option value="">{copy.workspacePlaceholder}</option>
          {workspaces.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
        {workspaces.length === 0 && (
          <p className="mt-1 text-xs text-muted-foreground">{copy.noWorkspaces}</p>
        )}
      </Step>

      {workspace !== '' && (
        <>
          <Step index={2} title={copy.stepSources}>
            <KontextOntologySourceList sources={state.sources ?? []} checks={state.checks} />
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => void ontology.importSources(includeMarkdown, false)}
                disabled={busy}
              >
                {state.busy === 'import' ? copy.busy : copy.importPreviewAction}
              </Button>
              <Button
                variant="secondary"
                onClick={() => void ontology.importSources(includeMarkdown, true)}
                disabled={busy}
              >
                {copy.importAction}
              </Button>
              <KontextOntologyAddSource
                disabled={busy}
                onAdd={ontology.addSource}
                onListRepositories={ontology.listRepositories}
              />
              <Button variant="secondary" onClick={() => void refresh()} disabled={busy}>
                {copy.refreshAction}
              </Button>
            </div>
            <label className="mt-2 flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={includeMarkdown}
                onChange={(event) => setIncludeMarkdown(event.target.checked)}
                disabled={busy}
              />
              {copy.includeMarkdown}
            </label>
            {errorFor('import', 'add', 'repositories')}
            {state.lastImport !== null && (
              <div role="status" className="mt-1 text-xs text-muted-foreground">
                <p>
                  {copy.importSummary(
                    state.lastImport.added.length,
                    state.lastImport.discovered.length
                  )}
                </p>
                {state.importWasPreview &&
                  (state.lastImport.added.length === 0 ? (
                    <p>{copy.importNothingNew}</p>
                  ) : (
                    <p>
                      {copy.importWouldAdd} {state.lastImport.added.join(', ')}
                    </p>
                  ))}
              </div>
            )}
          </Step>

          <Step index={3} title={copy.stepCheck}>
            <Button
              variant="secondary"
              className="mt-1.5"
              onClick={() => void ontology.check()}
              disabled={busy || !hasSources}
            >
              {state.busy === 'check' ? copy.busy : copy.checkAction}
            </Button>
            {state.checks !== null && (
              <p role="status" className="mt-1 text-xs text-muted-foreground">
                {checksPassed ? copy.checkAllOk : copy.checkSomeFailed}
              </p>
            )}
            {errorFor('check')}
          </Step>

          <Step index={4} title={copy.stepBuild}>
            <Label htmlFor="kontext-ontology-nodes" className="mt-1.5 block">
              {copy.targetNodes}
            </Label>
            <Input
              id="kontext-ontology-nodes"
              inputMode="numeric"
              className="mt-1"
              value={targetNodes}
              onChange={(event) => setTargetNodes(event.target.value)}
              disabled={busy}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => runSetup(false)}
                disabled={busy || !hasSources}
              >
                {state.busy === 'setup' ? copy.busy : copy.previewAction}
              </Button>
              <Button onClick={() => runSetup(true)} disabled={busy || !hasSources}>
                {copy.buildAction}
              </Button>
            </div>
            {errorFor('setup')}
            {nodeCountError !== null && (
              <p role="alert" className="mt-1 text-sm text-destructive">
                {nodeCountError}
              </p>
            )}
            {state.lastSetup !== null && (
              <p role="status" className="mt-1 text-xs text-muted-foreground">
                {copy.setupSummary(state.lastSetup.nodeIds.length, state.lastSetup.written)}
                {state.lastSetup.nodeIds.length > 0 && ` — ${state.lastSetup.nodeIds.join(', ')}`}
              </p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">{copy.scope}</p>
          </Step>
        </>
      )}

      {errorFor('list')}
    </section>
  )
}
