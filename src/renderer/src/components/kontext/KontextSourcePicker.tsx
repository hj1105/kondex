import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { getKontextInventoryCopy } from './kontext-inventory-copy'
import { getKontextSessionSourceCopy } from './kontext-session-source-copy'
import { useKontextSourceInventory } from './use-kontext-source-inventory'
import type { KontextRequestOwner } from './kontext-request-journal'

type Props = {
  owner: KontextRequestOwner
  provider: 'codex' | 'claude'
  selected: string[]
  onChange: (ids: string[]) => void
  disabled: boolean
}
export function KontextSourcePicker(props: Props): React.JSX.Element {
  return <SourcePicker key={JSON.stringify(props.owner)} {...props} />
}
function SourcePicker({ owner, provider, selected, onChange, disabled }: Props): React.JSX.Element {
  useTranslation()
  const copy = getKontextInventoryCopy()
  const inventory = useKontextSourceInventory(owner)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const sources =
    inventory.page?.sources.filter((source) =>
      `${source.title} ${'workspacePath' in source ? source.workspacePath : source.nativeSession.workspaceId} ${source.resourceId}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase())
    ) ?? []
  const selectedIds = new Set(selected)
  return (
    <Popover
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) {
          setQuery('')
          void inventory.load()
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-label={copy.browse}
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between text-xs"
        >
          {copy.browse}
          <ChevronsUpDown className="size-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-[min(480px,calc(100vw-1rem))] flex-col p-0">
        <p className="shrink-0 p-2 text-xs leading-4 text-muted-foreground">{copy.notice}</p>
        <Command shouldFilter={false} className="h-auto min-h-0">
          <CommandInput placeholder={copy.search} value={query} onValueChange={setQuery} />
          <CommandList>
            {!inventory.busy && !inventory.failed && <CommandEmpty>{copy.empty}</CommandEmpty>}
            {sources.map((source) => {
              const checked = selectedIds.has(source.resourceId)
              const permitted =
                source.status === 'active' &&
                source.sharing?.allowedRuntimeProviders.includes(provider)
              const limit = selectedIds.size >= 32
              return (
                <CommandItem
                  key={source.resourceId}
                  value={source.resourceId}
                  disabled={disabled || inventory.busy || (!checked && (!permitted || limit))}
                  onSelect={() => {
                    if (
                      !inventory.current() ||
                      disabled ||
                      inventory.busy ||
                      (!checked && (!permitted || limit))
                    ) {
                      return
                    }
                    onChange(
                      checked
                        ? selected.filter((id) => id !== source.resourceId)
                        : [...new Set([...selected, source.resourceId])]
                    )
                  }}
                  className="items-start gap-2 px-3 py-2"
                >
                  <Check
                    aria-hidden="true"
                    className={cn('mt-1 size-3 shrink-0', checked ? 'opacity-70' : 'opacity-0')}
                  />
                  <div className="min-w-0 space-y-1">
                    <p className="break-all text-sm">{source.title}</p>
                    <p className="break-all font-mono text-xs text-muted-foreground">
                      {'workspacePath' in source
                        ? source.workspacePath
                        : source.nativeSession.workspaceId}
                    </p>
                    <p className="text-xs">
                      {copy.allowed}:{' '}
                      {source.sharing?.allowedRuntimeProviders.join(', ') || copy.none}
                    </p>
                    {!permitted && <p className="text-xs text-muted-foreground">{copy.blocked}</p>}
                  </div>
                </CommandItem>
              )
            })}
          </CommandList>
        </Command>
        <div className="shrink-0 space-y-2 border-t border-border p-2">
          {inventory.page && inventory.page.nativeSessionsIncluded !== true && (
            <p className="text-xs text-muted-foreground">
              {getKontextSessionSourceCopy().legacyInventory}
            </p>
          )}
          {selectedIds.size >= 32 && <p className="text-xs">{copy.limit}</p>}
          {inventory.failed && (
            <p role="alert" className="text-xs text-destructive">
              {copy.error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={inventory.busy}
              onClick={() => void inventory.load()}
            >
              {copy.reload}
            </Button>
            {inventory.page?.nextCursor && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={inventory.busy}
                onClick={() => void inventory.load(true)}
              >
                {copy.more}
              </Button>
            )}
            <p role="status" className="min-h-5 flex-1 text-xs text-muted-foreground">
              {inventory.progress ? copy.busy : ''}
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
