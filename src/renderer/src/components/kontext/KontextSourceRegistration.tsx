import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import { getRuntimeEnvironmentRevision } from '@/runtime/runtime-environment-revision'
import {
  kontextMarkdownSourceRequestSchema,
  kontextMarkdownSourceResultSchema,
  type KontextMarkdownSourceResult
} from '../../../../shared/kontext-source-contract'
import type { KontextRequestOwner } from './kontext-request-journal'
import { getKontextSourceCopy } from './kontext-source-copy'
import { KontextSourceSharing } from './KontextSourceSharing'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { KontextSessionSourceRegistration } from './KontextSessionSourceRegistration'
import { getKontextSessionSourceCopy } from './kontext-session-source-copy'

export function KontextSourceRegistration({
  owner
}: {
  owner: KontextRequestOwner
}): React.JSX.Element {
  useTranslation()
  const copy = getKontextSessionSourceCopy()
  return (
    <Tabs key={JSON.stringify(owner)} defaultValue="markdown" className="mt-6">
      <TabsList>
        <TabsTrigger value="markdown">{copy.markdown}</TabsTrigger>
        <TabsTrigger value="session">{copy.tab}</TabsTrigger>
      </TabsList>
      <TabsContent value="markdown">
        <MarkdownSourceRegistration owner={owner} />
      </TabsContent>
      <TabsContent value="session">
        <KontextSessionSourceRegistration owner={owner} />
      </TabsContent>
    </Tabs>
  )
}

function MarkdownSourceRegistration({ owner }: { owner: KontextRequestOwner }): React.JSX.Element {
  useTranslation()
  const copy = getKontextSourceCopy()
  const [workspace, setWorkspace] = useState('')
  const [relativePath, setRelativePath] = useState('')
  const [result, setResult] = useState<KontextMarkdownSourceResult | null>(null)
  const [error, setError] = useState<'invalid' | 'failed' | 'ownerChanged' | null>(null)
  const [busy, setBusy] = useState(false)
  const [showProgress, setShowProgress] = useState(false)
  const inFlight = useRef(false)
  useEffect(() => {
    if (!busy) {
      setShowProgress(false)
      return
    }
    const timer = window.setTimeout(() => setShowProgress(true), 250)
    return () => window.clearTimeout(timer)
  }, [busy])
  const ownerCurrent = () =>
    owner.kind === 'local' ||
    getRuntimeEnvironmentRevision(owner.environmentId) === owner.pairingRevision
  async function register() {
    if (inFlight.current) {
      return
    }
    setResult(null)
    setError(null)
    const request = kontextMarkdownSourceRequestSchema.safeParse({ workspace, relativePath })
    if (!request.success) {
      setError('invalid')
      return
    }
    if (!ownerCurrent()) {
      setError('ownerChanged')
      return
    }
    inFlight.current = true
    setBusy(true)
    try {
      const response = await callRuntimeRpc<unknown>(
        owner,
        'kontext.registerMarkdownSource',
        request.data,
        {
          expectedEnvironmentPairingRevision:
            owner.kind === 'environment' ? owner.pairingRevision : undefined,
          timeoutMs: 60_000
        }
      )
      if (!ownerCurrent()) {
        setError('ownerChanged')
        return
      }
      const registered = kontextMarkdownSourceResultSchema.parse(response)
      if (registered.title !== relativePath.replaceAll('\\', '/')) {
        throw new Error('Source identity mismatch')
      }
      setResult(registered)
    } catch {
      setError('failed')
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }
  return (
    <section
      className="mt-7 space-y-4 border-t border-border pt-6"
      aria-labelledby="kontext-source-heading"
    >
      <div>
        <h2 id="kontext-source-heading" className="text-sm font-medium">
          {copy.title}
        </h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{copy.intro}</p>
      </div>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          void register()
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="kontext-source-workspace">{copy.workspace}</Label>
          <Input
            id="kontext-source-workspace"
            value={workspace}
            disabled={busy}
            aria-invalid={error === 'invalid'}
            onChange={(event) => {
              setWorkspace(event.target.value)
              setResult(null)
              setError(null)
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="kontext-source-path">{copy.path}</Label>
          <Input
            id="kontext-source-path"
            value={relativePath}
            disabled={busy}
            placeholder="docs/decisions.md"
            aria-invalid={error === 'invalid'}
            aria-describedby="kontext-source-scope"
            onChange={(event) => {
              setRelativePath(event.target.value)
              setResult(null)
              setError(null)
            }}
          />
          <p id="kontext-source-scope" className="text-xs leading-5 text-muted-foreground">
            {copy.scope}
          </p>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">{copy.privacy}</p>
        <Button type="submit" disabled={busy || !workspace.trim() || !relativePath}>
          {copy.register}
        </Button>
        <p role="status" className="min-h-5 text-xs text-muted-foreground">
          {showProgress ? copy.busy : ''}
        </p>
      </form>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {copy[error]}
        </p>
      )}
      {result && (
        <div className="space-y-2" aria-live="polite">
          <h3 className="text-sm font-medium">
            {result.changed ? copy.registered : copy.unchanged}
          </h3>
          <p className="break-all font-mono text-xs">{result.title}</p>
          <p className="text-xs text-muted-foreground">{copy.snapshot}</p>
          <dl className="grid gap-2 text-xs sm:grid-cols-[auto_minmax(0,1fr)]">
            <dt className="text-muted-foreground">{copy.resource}</dt>
            <dd className="break-all font-mono">{result.resourceId}</dd>
            <dt className="text-muted-foreground">{copy.hash}</dt>
            <dd className="break-all font-mono">{result.contentHash}</dd>
            <dt className="text-muted-foreground">{copy.evidence}</dt>
            <dd>{result.evidence.length}</dd>
          </dl>
        </div>
      )}
      <KontextSourceSharing
        key={JSON.stringify([result?.resourceId, result?.contentHash])}
        owner={owner}
        initialResourceId={result?.resourceId}
      />
    </section>
  )
}
