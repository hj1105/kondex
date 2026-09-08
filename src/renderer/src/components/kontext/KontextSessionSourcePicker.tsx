import { useState } from 'react'
import { ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import { getKontextSessionSourceCopy } from './kontext-session-source-copy'

export function KontextSessionSourcePicker({
  sessions,
  selected,
  onSelect,
  disabled
}: {
  sessions: { sessionId: string; workspaceId: string; agent: 'codex' | 'claude' }[]
  selected: string
  onSelect: (id: string) => void
  disabled: boolean
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const copy = getKontextSessionSourceCopy()
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-label={copy.select}
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between"
        >
          <span className="truncate">{selected || copy.select}</span>
          <ChevronsUpDown className="shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(36rem,var(--radix-popover-content-available-width))] p-0"
      >
        <Command>
          <CommandInput aria-label={copy.search} placeholder={copy.search} />
          <CommandList className="max-h-64 scrollbar-sleek">
            <CommandEmpty>{copy.empty}</CommandEmpty>
            {sessions.map((session) => (
              <CommandItem
                key={session.sessionId}
                value={`${session.agent} ${session.workspaceId} ${session.sessionId}`}
                onSelect={() => {
                  onSelect(session.sessionId)
                  setOpen(false)
                }}
              >
                <div className="min-w-0 space-y-1">
                  <p className="break-all text-sm">{session.sessionId}</p>
                  <p className="break-all text-xs text-muted-foreground">
                    {session.agent} · {session.workspaceId}
                  </p>
                </div>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
