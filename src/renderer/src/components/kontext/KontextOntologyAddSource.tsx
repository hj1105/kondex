import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  KONTEXT_SOURCE_TYPES,
  type KontextOntologyRepositoriesResult
} from '../../../../shared/kontext-ontology-contract'
import { getKontextOntologyCopy } from './kontext-ontology-copy'
import { KontextOntologyRepositoryPicker } from './KontextOntologyRepositoryPicker'
import type { AddSourceInput } from './use-kontext-ontology'

/**
 * Adds a provider that is not registered with another agent. Presets pick the
 * transport and layer type a provider actually uses; the address is left to the
 * user because inventing a package name or URL would ship a broken default.
 * The organization preset lists repositories through the user's own gh login
 * and hands them to the picker, so a whole org becomes a checklist.
 */
type Copy = ReturnType<typeof getKontextOntologyCopy>

type Preset = {
  readonly id: string
  readonly label: string | ((copy: Copy) => string)
  readonly transport: AddSourceInput['transport']
  readonly type?: AddSourceInput['type']
  /** Lists an owner's repositories instead of taking one address. */
  readonly organization?: boolean
}

// Why the repository preset comes first: pasting a clone URL needs no server and
// no token, so it is the path most people can finish without leaving the dialog.
const PRESETS: readonly Preset[] = [
  { id: 'github_repo', label: (copy) => copy.presetGithubRepo, transport: 'git' },
  {
    id: 'github_org',
    label: (copy) => copy.presetGithubOrg,
    transport: 'git',
    organization: true
  },
  { id: 'notion', label: 'Notion', transport: 'sse', type: 'notion' },
  { id: 'github_pr', label: (copy) => copy.presetGithubMcp, transport: 'stdio', type: 'github_pr' },
  { id: 'jira', label: 'Jira', transport: 'sse', type: 'jira' },
  { id: 'slack', label: 'Slack', transport: 'sse', type: 'slack' },
  { id: 'local', label: 'Markdown', transport: 'local' },
  { id: 'mcp_server', label: (copy) => copy.presetMcpServer, transport: 'stdio' },
  { id: 'mcp_remote', label: (copy) => copy.presetMcpRemote, transport: 'http' }
]

const TRANSPORTS: readonly AddSourceInput['transport'][] = ['git', 'sse', 'http', 'stdio', 'local']

/** `https://github.com/<owner>` with nothing after it names an organization or user, not a repository. */
export function isGithubOwnerUrl(value: string): boolean {
  return /^(https?:\/\/)?(www\.)?github\.com\/[A-Za-z0-9][A-Za-z0-9-]*\/?$/i.test(value.trim())
}

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
  onAdd,
  onListRepositories
}: {
  disabled: boolean
  onAdd: (input: AddSourceInput) => Promise<boolean>
  onListRepositories?: (owner: string) => Promise<KontextOntologyRepositoriesResult | null>
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
  const [headers, setHeaders] = useState('')
  const [readCode, setReadCode] = useState(false)
  const [organization, setOrganization] = useState(false)
  const [listing, setListing] = useState<KontextOntologyRepositoriesResult | null>(null)

  const reset = (): void => {
    setName('')
    setAddress('')
    setRef('')
    setCommandArgs('')
    setEnvironment('')
    setHeaders('')
    setReadCode(false)
    setListing(null)
  }

  const applyPreset = (preset: Preset): void => {
    reset()
    setName(preset.organization ? '' : preset.id)
    setTransport(preset.transport)
    setType(preset.type ?? '')
    setOrganization(preset.organization === true)
  }

  const addressLabel = organization
    ? copy.owner
    : transport === 'stdio'
      ? copy.command
      : transport === 'sse' || transport === 'http'
        ? copy.url
        : transport === 'git'
          ? copy.repositoryUrl
          : copy.path
  const readsFiles = transport === 'git' || transport === 'local'
  const remoteServer = transport === 'sse' || transport === 'http'

  const submit = async (): Promise<void> => {
    const parsedArgs = commandArgs
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '')
    const env = transport === 'stdio' ? parseEnvironmentLines(environment) : undefined
    const parsedHeaders = remoteServer ? parseEnvironmentLines(headers) : undefined
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
      ...(remoteServer
        ? { url: address.trim(), ...(parsedHeaders ? { headers: parsedHeaders } : {}) }
        : {}),
      ...(transport === 'git'
        ? { url: address.trim(), ...(ref.trim() ? { ref: ref.trim() } : {}) }
        : {}),
      ...(transport === 'local' ? { path: address.trim() } : {}),
      ...(readsFiles && readCode ? { code: true } : {})
    }
    if (await onAdd(input)) {
      close()
    }
  }

  const loadRepositories = async (): Promise<void> => {
    if (!onListRepositories) {
      return
    }
    setListing(await onListRepositories(address.trim()))
  }

  const close = (): void => {
    setOpen(false)
    reset()
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

      {!organization && (
        <>
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
        </>
      )}

      <Label htmlFor="kontext-ontology-add-address">{addressLabel}</Label>
      <Input
        id="kontext-ontology-add-address"
        value={address}
        onChange={(event) => {
          const value = event.target.value
          setAddress(value)
          // Why: git clone of an owner URL fails; the organization list is what that address means.
          if (!organization && transport === 'git' && isGithubOwnerUrl(value)) {
            setOrganization(true)
            setName('')
            setListing(null)
          }
        }}
        disabled={disabled}
        placeholder={
          organization
            ? 'https://github.com/org'
            : transport === 'git'
              ? 'https://github.com/org/repo.git'
              : undefined
        }
      />

      {organization && (
        <>
          <p className="text-xs text-muted-foreground">{copy.ownerHint}</p>
          <div>
            <Button
              variant="secondary"
              onClick={() => void loadRepositories()}
              disabled={disabled || address.trim() === '' || !onListRepositories}
            >
              {copy.listRepositories}
            </Button>
          </div>
          {listing !== null && (
            <KontextOntologyRepositoryPicker
              key={listing.owner}
              listing={listing}
              disabled={disabled}
              readCode={readCode}
              onAdd={onAdd}
              onAllAdded={close}
            />
          )}
        </>
      )}

      {transport === 'git' && !organization && (
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

      {readsFiles && (
        <>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={readCode}
              onChange={(event) => setReadCode(event.target.checked)}
              disabled={disabled}
            />
            {copy.readCode}
          </label>
          <p className="text-xs text-muted-foreground">{copy.readCodeHint}</p>
        </>
      )}

      {remoteServer && (
        <>
          <Label htmlFor="kontext-ontology-add-headers">{copy.headers}</Label>
          <textarea
            id="kontext-ontology-add-headers"
            className="scrollbar-sleek min-h-16 rounded-md border border-border bg-background px-2 py-1.5 font-mono text-sm text-foreground"
            value={headers}
            onChange={(event) => setHeaders(event.target.value)}
            disabled={disabled}
            spellCheck={false}
          />
          <p className="text-xs text-muted-foreground">{copy.headersHint}</p>
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

      {!organization && (
        <>
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
        </>
      )}

      <div className="mt-1 flex gap-2">
        {!organization && (
          <Button
            onClick={() => void submit()}
            disabled={disabled || name.trim() === '' || address.trim() === ''}
          >
            {copy.addConfirm}
          </Button>
        )}
        <Button variant="secondary" onClick={() => setOpen(false)} disabled={disabled}>
          {copy.cancel}
        </Button>
      </div>
    </div>
  )
}
