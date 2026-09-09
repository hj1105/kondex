import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { KONTEXT_SOURCE_TYPES } from '../../../../shared/kontext-ontology-contract'
import { getKontextOntologyCopy } from './kontext-ontology-copy'
import type { AddSourceInput } from './use-kontext-ontology'

/**
 * Adds a provider that is not registered with another agent. Presets pick the
 * transport and layer type a provider actually uses; the address is left to the
 * user because inventing a package name or URL would ship a broken default.
 */
type Copy = ReturnType<typeof getKontextOntologyCopy>

type Preset = {
  readonly id: string
  readonly label: string | ((copy: Copy) => string)
  readonly transport: AddSourceInput['transport']
  readonly type?: AddSourceInput['type']
}

// Why the repository preset comes first: pasting a clone URL needs no server and
// no token, so it is the path most people can finish without leaving the dialog.
const PRESETS: readonly Preset[] = [
  { id: 'github_repo', label: (copy) => copy.presetGithubRepo, transport: 'git' },
  { id: 'notion', label: 'Notion', transport: 'sse', type: 'notion' },
  { id: 'github_pr', label: (copy) => copy.presetGithubMcp, transport: 'stdio', type: 'github_pr' },
  { id: 'jira', label: 'Jira', transport: 'sse', type: 'jira' },
  { id: 'slack', label: 'Slack', transport: 'sse', type: 'slack' },
  { id: 'local', label: 'Markdown', transport: 'local' }
]

const TRANSPORTS: readonly AddSourceInput['transport'][] = ['git', 'sse', 'stdio', 'local']

/** One `KEY=VALUE` per line; a line without `=` is left for the CLI to reject by name. */
function parseEnvironmentLines(text: string): Record<string, string> | undefined {
  const entries = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .map((line) => {
      const separator = line.indexOf('=')
      return separator > 0 ? [line.slice(0, separator), line.slice(separator + 1)] : [line, '']
    })
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

export function KontextOntologyAddSource({
  disabled,
  onAdd
}: {
  disabled: boolean
  onAdd: (input: AddSourceInput) => Promise<boolean>
}): React.JSX.Element {
  const copy = getKontextOntologyCopy()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [transport, setTransport] = useState<AddSourceInput['transport']>('git')
  const [type, setType] = useState<AddSourceInput['type'] | ''>('')
  const [address, setAddress] = useState('')
  const [ref, setRef] = useState('')
  const [commandArgs, setCommandArgs] = useState('')
  const [environment, setEnvironment] = useState('')

  const applyPreset = (preset: Preset): void => {
    setName(preset.id)
    setTransport(preset.transport)
    setType(preset.type ?? '')
    setAddress('')
    setRef('')
    setCommandArgs('')
    setEnvironment('')
  }

  const addressLabel =
    transport === 'stdio'
      ? copy.command
      : transport === 'sse'
        ? copy.url
        : transport === 'git'
          ? copy.repositoryUrl
          : copy.path

  const submit = async (): Promise<void> => {
    const parsedArgs = commandArgs
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '')
    const env = transport === 'stdio' ? parseEnvironmentLines(environment) : undefined
    const input: AddSourceInput = {
      name: name.trim(),
      transport,
      ...(type === '' ? {} : { type }),
      ...(transport === 'stdio'
        ? {
            command: address.trim(),
            ...(parsedArgs.length > 0 ? { args: parsedArgs } : {}),
            ...(env ? { env } : {})
          }
        : {}),
      ...(transport === 'sse' ? { url: address.trim() } : {}),
      ...(transport === 'git'
        ? { url: address.trim(), ...(ref.trim() ? { ref: ref.trim() } : {}) }
        : {}),
      ...(transport === 'local' ? { path: address.trim() } : {})
    }
    if (await onAdd(input)) {
      setOpen(false)
      setName('')
      setAddress('')
      setRef('')
      setCommandArgs('')
      setEnvironment('')
    }
  }

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)} disabled={disabled}>
        {copy.addAction}
      </Button>
    )
  }

  return (
    <div className="mt-2 flex flex-col gap-2 rounded-md border border-border p-3">
      <p className="text-xs text-muted-foreground">{copy.addIntro}</p>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => (
          <Button
            key={preset.id}
            variant="secondary"
            className="h-7 px-2 text-xs"
            onClick={() => applyPreset(preset)}
            disabled={disabled}
          >
            {typeof preset.label === 'function' ? preset.label(copy) : preset.label}
          </Button>
        ))}
      </div>

      <Label htmlFor="kontext-ontology-add-name">{copy.sourceName}</Label>
      <Input
        id="kontext-ontology-add-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        disabled={disabled}
      />

      <Label htmlFor="kontext-ontology-add-transport">{copy.transport}</Label>
      <select
        id="kontext-ontology-add-transport"
        className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
        value={transport}
        onChange={(event) => setTransport(event.target.value as AddSourceInput['transport'])}
        disabled={disabled}
      >
        {TRANSPORTS.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>

      <Label htmlFor="kontext-ontology-add-address">{addressLabel}</Label>
      <Input
        id="kontext-ontology-add-address"
        value={address}
        onChange={(event) => setAddress(event.target.value)}
        disabled={disabled}
        placeholder={transport === 'git' ? 'https://github.com/org/repo.git' : undefined}
      />
      {transport === 'git' && (
        <>
          <p className="text-xs text-muted-foreground">{copy.repositoryUrlHint}</p>
          <Label htmlFor="kontext-ontology-add-ref">{copy.ref}</Label>
          <Input
            id="kontext-ontology-add-ref"
            value={ref}
            onChange={(event) => setRef(event.target.value)}
            disabled={disabled}
          />
        </>
      )}

      {transport === 'stdio' && (
        <>
          <Label htmlFor="kontext-ontology-add-args">{copy.commandArgs}</Label>
          <textarea
            id="kontext-ontology-add-args"
            className="scrollbar-sleek min-h-16 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            value={commandArgs}
            onChange={(event) => setCommandArgs(event.target.value)}
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground">{copy.commandArgsHint}</p>
          <Label htmlFor="kontext-ontology-add-env">{copy.env}</Label>
          <textarea
            id="kontext-ontology-add-env"
            className="scrollbar-sleek min-h-16 rounded-md border border-border bg-background px-2 py-1.5 font-mono text-sm text-foreground"
            value={environment}
            onChange={(event) => setEnvironment(event.target.value)}
            disabled={disabled}
            spellCheck={false}
          />
          <p className="text-xs text-muted-foreground">{copy.envHint}</p>
        </>
      )}

      <Label htmlFor="kontext-ontology-add-type">{copy.layerType}</Label>
      <select
        id="kontext-ontology-add-type"
        className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
        value={type}
        onChange={(event) => setType(event.target.value as AddSourceInput['type'] | '')}
        disabled={disabled}
      >
        <option value="">{copy.layerTypeNone}</option>
        {KONTEXT_SOURCE_TYPES.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>

      <div className="mt-1 flex gap-2">
        <Button
          onClick={() => void submit()}
          disabled={disabled || name.trim() === '' || address.trim() === ''}
        >
          {copy.addConfirm}
        </Button>
        <Button variant="secondary" onClick={() => setOpen(false)} disabled={disabled}>
          {copy.cancel}
        </Button>
      </div>
    </div>
  )
}
