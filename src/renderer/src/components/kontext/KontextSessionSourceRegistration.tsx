import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { useKontextSessionSources } from './use-kontext-session-sources'
import { getKontextSessionSourceCopy } from './kontext-session-source-copy'
import { getKontextSourceCopy } from './kontext-source-copy'
import { KontextSessionSourcePicker } from './KontextSessionSourcePicker'
import { KontextSourceSharing } from './KontextSourceSharing'
import type { KontextRequestOwner } from './kontext-request-journal'

export function KontextSessionSourceRegistration({
  owner
}: {
  owner: KontextRequestOwner
}): React.JSX.Element {
  useTranslation()
  const source = useKontextSessionSources(owner)
  const copy = getKontextSessionSourceCopy()
  const common = getKontextSourceCopy()
  const preview = source.preview
  return (
    <section
      className="mt-7 space-y-4 border-t border-border pt-6"
      aria-labelledby="kontext-session-source-heading"
    >
      <div>
        <h2 id="kontext-session-source-heading" className="text-sm font-medium">
          {copy.title}
        </h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{copy.intro}</p>
      </div>
      <Button
        variant="outline"
        disabled={!!source.busy}
        onClick={() => void source.perform('list')}
      >
        {copy.list}
      </Button>
      {source.list && (
        <>
          {source.list.sessions.length === 0 ? (
            <p className="text-xs text-muted-foreground">{copy.empty}</p>
          ) : (
            <KontextSessionSourcePicker
              sessions={source.list.sessions}
              selected={source.selected}
              onSelect={source.select}
              disabled={!!source.busy}
            />
          )}
          <Button
            variant={preview ? 'outline' : 'default'}
            disabled={!!source.busy || !source.selected || source.list.registrationVersion !== 1}
            onClick={() => void source.perform('preview')}
          >
            {copy.preview}
          </Button>
        </>
      )}
      <p role="status" className="min-h-5 text-xs text-muted-foreground">
        {source.progress ? copy.busy : ''}
      </p>
      {source.error && (
        <p role="alert" className="text-sm text-destructive">
          {copy[source.error]}
        </p>
      )}
      {preview && (
        <div className="space-y-3">
          <p className="text-xs leading-5 text-muted-foreground">{copy.scope}</p>
          <details>
            <summary className="cursor-pointer text-xs">{copy.provenance}</summary>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-xs scrollbar-sleek">
              {JSON.stringify(
                {
                  origin: preview.origin,
                  journalCursor: preview.journalCursor,
                  contentDigest: preview.contentDigest
                },
                null,
                2
              )}
            </pre>
          </details>
          <p className="text-xs text-muted-foreground">
            {copy.exclusions}: {preview.excluded.items} / {preview.excluded.blocks} /{' '}
            {preview.excluded.unconfirmedSubmissions}
          </p>
          <div
            role="region"
            aria-label={copy.review}
            tabIndex={0}
            className="max-h-80 space-y-3 overflow-auto rounded-md border border-border p-3 scrollbar-sleek"
          >
            {preview.messages.map((message) => (
              <article key={message.itemId} className="space-y-1">
                <p className="break-all text-xs text-muted-foreground">
                  {message.role} · {message.itemId} · r{message.revision}
                </p>
                {message.blocks.map((block) => (
                  <pre
                    key={block.index}
                    className="whitespace-pre-wrap break-words font-mono text-xs"
                  >
                    {block.text}
                  </pre>
                ))}
              </article>
            ))}
          </div>
          <div className="flex items-start gap-2">
            <Checkbox
              id="kontext-session-source-consent"
              checked={source.consent}
              disabled={!!source.busy}
              onCheckedChange={(value) => source.setConsent(value === true)}
            />
            <Label htmlFor="kontext-session-source-consent" className="text-xs leading-5">
              {copy.consent}
            </Label>
          </div>
          <Button
            disabled={!!source.busy || !source.consent}
            onClick={() => void source.perform('register')}
          >
            {copy.register}
          </Button>
        </div>
      )}
      {source.result && (
        <div className="space-y-2" aria-live="polite">
          <h3 className="text-sm font-medium">
            {source.result.changed ? common.registered : common.unchanged}
          </h3>
          <p className="text-xs text-muted-foreground">{common.privacy}</p>
          <dl className="grid gap-2 text-xs sm:grid-cols-[auto_minmax(0,1fr)]">
            <dt>{common.resource}</dt>
            <dd className="break-all font-mono">{source.result.resourceId}</dd>
            <dt>{common.hash}</dt>
            <dd className="break-all font-mono">{source.result.contentHash}</dd>
            <dt>{common.evidence}</dt>
            <dd>{source.result.evidence.length}</dd>
          </dl>
          <KontextSourceSharing
            key={`${source.result.resourceId}:${source.result.contentHash}`}
            owner={owner}
            initialResourceId={source.result.resourceId}
          />
        </div>
      )}
    </section>
  )
}
