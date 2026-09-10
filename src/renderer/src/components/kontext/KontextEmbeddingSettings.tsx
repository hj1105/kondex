import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  KONTEXT_EMBEDDING_PROVIDERS,
  type KontextEmbeddingProvider,
  type KontextEmbeddingSettings
} from '../../../../shared/kontext-ontology-contract'
import { getKontextOntologyCopy } from './kontext-ontology-copy'
import type { EmbeddingInput } from './use-kontext-embedding-actions'

/**
 * Chooses how knowledge search embeds text. The default runs a small model
 * inside the app with nothing to install; a person with Ollama or an API key
 * can point at those instead, or turn vectors off. Saving records the choice
 * in kontext.yaml and beside the graph; "embed now" fills in vectors for
 * chunks that have none in the chosen space without rebuilding the ontology.
 */
type Copy = ReturnType<typeof getKontextOntologyCopy>

const DEFAULT_MODELS: Record<KontextEmbeddingProvider, string> = {
  builtin: 'Xenova/multilingual-e5-small',
  ollama: 'nomic-embed-text',
  openai: 'text-embedding-3-small',
  none: ''
}

const DEFAULT_BASE_URLS: Record<KontextEmbeddingProvider, string> = {
  builtin: '',
  ollama: 'http://127.0.0.1:11434',
  openai: 'https://api.openai.com/v1',
  none: ''
}

export function providerLabel(copy: Copy, provider: KontextEmbeddingProvider): string {
  switch (provider) {
    case 'builtin':
      return copy.providerBuiltin
    case 'ollama':
      return copy.providerOllama
    case 'openai':
      return copy.providerOpenai
    case 'none':
      return copy.providerNone
  }
}

export function describeEmbedding(copy: Copy, settings: KontextEmbeddingSettings): string {
  if (settings.provider === 'none') {
    return copy.providerNone
  }
  const where = settings.baseUrl ? ` · ${settings.baseUrl}` : ''
  return `${providerLabel(copy, settings.provider)} · ${settings.model}${where}`
}

function hintFor(copy: Copy, provider: KontextEmbeddingProvider): string {
  switch (provider) {
    case 'builtin':
      return copy.embeddingHintBuiltin
    case 'ollama':
      return copy.embeddingHintOllama
    case 'openai':
      return copy.embeddingHintOpenai
    case 'none':
      return copy.embeddingHintNone
  }
}

export function KontextEmbeddingSettings({
  settings,
  disabled,
  busy,
  onSave,
  onEmbed
}: {
  settings: KontextEmbeddingSettings | null
  disabled: boolean
  busy: 'embedding' | 'embed' | null
  onSave: (input: EmbeddingInput) => Promise<boolean>
  onEmbed: () => void
}): React.JSX.Element {
  const copy = getKontextOntologyCopy()
  const [editing, setEditing] = useState(false)
  const [provider, setProvider] = useState<KontextEmbeddingProvider>('builtin')
  const [model, setModel] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKeyEnv, setApiKeyEnv] = useState('')

  const startEditing = (): void => {
    const current = settings ?? { provider: 'builtin', model: '', baseUrl: null, apiKeyEnv: null }
    setProvider(current.provider)
    // Why: defaults are shown as placeholders, so only a deliberate choice fills a field.
    setModel(current.model === DEFAULT_MODELS[current.provider] ? '' : current.model)
    setBaseUrl(
      current.baseUrl === null || current.baseUrl === DEFAULT_BASE_URLS[current.provider]
        ? ''
        : current.baseUrl
    )
    setApiKeyEnv(
      current.apiKeyEnv === null || current.apiKeyEnv === 'OPENAI_API_KEY' ? '' : current.apiKeyEnv
    )
    setEditing(true)
  }

  const save = async (): Promise<void> => {
    const remote = provider === 'ollama' || provider === 'openai'
    const input: EmbeddingInput = {
      provider,
      ...(model.trim() && provider !== 'none' ? { model: model.trim() } : {}),
      ...(baseUrl.trim() && remote ? { baseUrl: baseUrl.trim() } : {}),
      ...(apiKeyEnv.trim() && provider === 'openai' ? { apiKeyEnv: apiKeyEnv.trim() } : {})
    }
    if (await onSave(input)) {
      setEditing(false)
    }
  }

  return (
    <div className="mt-3 rounded-md border border-border p-3">
      <p className="text-sm text-foreground">
        <span className="font-medium">{copy.embeddingTitle}</span>
        <span className="ml-2 text-muted-foreground">
          {settings === null ? copy.embeddingUnknown : describeEmbedding(copy, settings)}
        </span>
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{copy.embeddingIntro}</p>
      {!editing && (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={startEditing} disabled={disabled}>
            {copy.embeddingChange}
          </Button>
          {settings !== null && settings.provider !== 'none' && (
            <Button variant="secondary" onClick={onEmbed} disabled={disabled}>
              {busy === 'embed' ? copy.busy : copy.embedNow}
            </Button>
          )}
        </div>
      )}
      {editing && (
        <div className="mt-2 flex flex-col gap-2">
          <Label htmlFor="kontext-embedding-provider">{copy.embeddingProvider}</Label>
          <select
            id="kontext-embedding-provider"
            className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
            value={provider}
            onChange={(event) => {
              setProvider(event.target.value as KontextEmbeddingProvider)
              setModel('')
              setBaseUrl('')
            }}
            disabled={disabled}
          >
            {KONTEXT_EMBEDDING_PROVIDERS.map((value) => (
              <option key={value} value={value}>
                {providerLabel(copy, value)}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">{hintFor(copy, provider)}</p>
          {provider !== 'none' && (
            <>
              <Label htmlFor="kontext-embedding-model">{copy.embeddingModel}</Label>
              <Input
                id="kontext-embedding-model"
                value={model}
                placeholder={DEFAULT_MODELS[provider]}
                onChange={(event) => setModel(event.target.value)}
                disabled={disabled}
                spellCheck={false}
              />
            </>
          )}
          {(provider === 'ollama' || provider === 'openai') && (
            <>
              <Label htmlFor="kontext-embedding-base-url">{copy.embeddingBaseUrl}</Label>
              <Input
                id="kontext-embedding-base-url"
                value={baseUrl}
                placeholder={DEFAULT_BASE_URLS[provider]}
                onChange={(event) => setBaseUrl(event.target.value)}
                disabled={disabled}
                spellCheck={false}
              />
            </>
          )}
          {provider === 'openai' && (
            <>
              <Label htmlFor="kontext-embedding-api-key-env">{copy.embeddingApiKeyEnv}</Label>
              <Input
                id="kontext-embedding-api-key-env"
                value={apiKeyEnv}
                placeholder="OPENAI_API_KEY"
                onChange={(event) => setApiKeyEnv(event.target.value)}
                disabled={disabled}
                spellCheck={false}
              />
            </>
          )}
          <div className="flex gap-2">
            <Button onClick={() => void save()} disabled={disabled}>
              {busy === 'embedding' ? copy.busy : copy.embeddingSave}
            </Button>
            <Button variant="secondary" onClick={() => setEditing(false)} disabled={disabled}>
              {copy.cancel}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
