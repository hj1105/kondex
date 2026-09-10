import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type {
  KontextOntologyInspectResult,
  KontextOntologySource,
  KontextToolDocumentMapping
} from '../../../../shared/kontext-ontology-contract'
import { getKontextOntologyCopy } from './kontext-ontology-copy'

/**
 * Most MCP servers answer tools/list and nothing on resources/list. This panel
 * shows what a connected server exposes and lets a person name the tool that
 * lists documents and the one that reads one, which is all the ontology build
 * needs to treat that server as a document source.
 */
const SERVER_TRANSPORTS: ReadonlySet<string> = new Set(['stdio', 'sse', 'http'])

type MappingDraft = {
  listTool: string
  listArguments: string
  items: string
  id: string
  title: string
  readTool: string
  idArgument: string
  content: string
}

const EMPTY_DRAFT: MappingDraft = {
  listTool: '',
  listArguments: '',
  items: '',
  id: 'id',
  title: '',
  readTool: '',
  idArgument: 'id',
  content: ''
}

/** Empty when the JSON is invalid; the CLI would reject it with a worse message. */
function parseArguments(text: string): Record<string, unknown> | undefined | 'invalid' {
  if (text.trim() === '') {
    return undefined
  }
  try {
    const value: unknown = JSON.parse(text)
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : 'invalid'
  } catch {
    return 'invalid'
  }
}

export function toMapping(draft: MappingDraft): KontextToolDocumentMapping | null {
  const listArguments = parseArguments(draft.listArguments)
  if (listArguments === 'invalid') {
    return null
  }
  if (draft.listTool.trim() === '' || draft.readTool.trim() === '') {
    return null
  }
  if (draft.id.trim() === '' || draft.idArgument.trim() === '') {
    return null
  }
  return {
    list: {
      tool: draft.listTool.trim(),
      ...(listArguments ? { arguments: listArguments } : {}),
      ...(draft.items.trim() ? { items: draft.items.trim() } : {}),
      id: draft.id.trim(),
      ...(draft.title.trim() ? { title: draft.title.trim() } : {})
    },
    read: {
      tool: draft.readTool.trim(),
      idArgument: draft.idArgument.trim(),
      ...(draft.content.trim() ? { content: draft.content.trim() } : {})
    }
  }
}

export function KontextOntologyServerMappingPanel({
  sources,
  inspection,
  disabled,
  busy,
  onInspect,
  onMap
}: {
  sources: readonly KontextOntologySource[]
  inspection: KontextOntologyInspectResult | null
  disabled: boolean
  busy: 'inspect' | 'map' | null
  onInspect: (name: string) => void
  onMap: (name: string, mapping: KontextToolDocumentMapping) => Promise<boolean>
}): React.JSX.Element | null {
  const copy = getKontextOntologyCopy()
  const servers = sources.filter((source) => SERVER_TRANSPORTS.has(source.transport))
  const [selected, setSelected] = useState('')
  const [mapping, setMapping] = useState(false)
  const [draft, setDraft] = useState<MappingDraft>(EMPTY_DRAFT)
  if (servers.length === 0) {
    return null
  }
  const name = servers.some((server) => server.name === selected)
    ? selected
    : (servers[0]?.name ?? '')
  const shown = inspection !== null && inspection.name === name ? inspection : null
  const parsed = toMapping(draft)
  const field = (
    key: keyof MappingDraft,
    label: string,
    options?: readonly string[]
  ): React.JSX.Element => (
    <div key={key}>
      <Label htmlFor={`kontext-mapping-${key}`}>{label}</Label>
      <Input
        id={`kontext-mapping-${key}`}
        list={options ? `kontext-mapping-${key}-tools` : undefined}
        value={draft[key]}
        onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
        disabled={disabled}
        spellCheck={false}
      />
      {options && (
        <datalist id={`kontext-mapping-${key}-tools`}>
          {options.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      )}
    </div>
  )
  const toolNames = shown?.tools.map((tool) => tool.name)

  return (
    <div className="mt-2 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label={copy.sourceName}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
          value={name}
          onChange={(event) => {
            setSelected(event.target.value)
            setMapping(false)
          }}
          disabled={disabled}
        >
          {servers.map((server) => (
            <option key={server.name} value={server.name}>
              {server.name}
            </option>
          ))}
        </select>
        <Button variant="secondary" onClick={() => onInspect(name)} disabled={disabled}>
          {busy === 'inspect' ? copy.busy : copy.inspectAction}
        </Button>
        {shown !== null && (
          <Button variant="secondary" onClick={() => setMapping(!mapping)} disabled={disabled}>
            {copy.mapAction}
          </Button>
        )}
      </div>
      {shown !== null && (
        <div className="mt-2">
          <p role="status" className="text-xs text-muted-foreground">
            {copy.inspectSummary(shown.resourceCount, shown.tools.length)}
          </p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {shown.tools.map((tool) => (
              <li key={tool.name} className="text-xs text-foreground">
                <span className="font-mono">{tool.name}</span>
                {tool.description !== '' && (
                  <span className="ml-1.5 text-muted-foreground">{tool.description}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {shown !== null && mapping && (
        <div className="mt-2 flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">{copy.mapIntro}</p>
          {field('listTool', copy.listTool, toolNames)}
          {field('listArguments', copy.listArguments)}
          {field('items', copy.itemsPath)}
          {field('id', copy.idPath)}
          {field('title', copy.titlePath)}
          {field('readTool', copy.readTool, toolNames)}
          {field('idArgument', copy.idArgument)}
          {field('content', copy.contentPath)}
          <div>
            <Button
              onClick={() => {
                if (parsed) {
                  void onMap(name, parsed).then((saved) => {
                    if (saved) {
                      setMapping(false)
                    }
                  })
                }
              }}
              disabled={disabled || parsed === null}
            >
              {busy === 'map' ? copy.busy : copy.saveMapping}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
