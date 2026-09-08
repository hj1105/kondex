import React from 'react'
import { ChevronDown, Cloud, Plus, Server } from 'lucide-react'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import { RUN_TARGET_ADD_HOST_KEY } from './run-target-options'
import { RunTargetRow } from './RunTargetComboboxRow'
import { COMBOBOX_POPOVER_SURFACE } from './type-ahead-combobox-styles'

const SUBMENU_CONTENT = cn('w-72 p-1', COMBOBOX_POPOVER_SURFACE)

/**
 * "Add host", pinned to the popover edge so it stays reachable in every state —
 * scrolled, filtered to nothing, or with no hosts at all.
 */
export function AddHostSubmenuRow({
  open,
  onOpenChange,
  armed,
  optionId,
  onArm,
  onAddSshHost,
  onAddRemoteServer
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  armed: boolean
  optionId: string | undefined
  onArm: () => void
  onAddSshHost?: () => void
  onAddRemoteServer?: () => void
}): React.JSX.Element {
  const [hoveredKey, setHoveredKey] = React.useState<string | null>(null)
  const addHostLabel = translate('auto.components.NewWorkspaceComposerCard.addHost', 'Add host')
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>
        <div
          role="option"
          id={optionId}
          aria-selected={armed}
          // `option` supports aria-haspopup but not aria-expanded.
          aria-haspopup="menu"
          data-armed={armed || undefined}
          data-run-target-add-host="true"
          onMouseDown={(event) => event.preventDefault()}
          onMouseMove={onArm}
          onClick={() => onOpenChange(true)}
          className={cn(
            'flex h-9 shrink-0 cursor-default items-center gap-2 border-t border-border px-2 text-sm',
            armed && 'bg-accent text-accent-foreground'
          )}
        >
          <Plus className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{addHostLabel}</span>
          <span className="ml-auto flex shrink-0 items-center">
            <ChevronDown className="size-3.5 -rotate-90 text-muted-foreground" />
          </span>
        </div>
      </PopoverAnchor>
      <PopoverContent
        side="right"
        align="end"
        sideOffset={6}
        className={SUBMENU_CONTENT}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div role="listbox" aria-label={addHostLabel} onMouseLeave={() => setHoveredKey(null)}>
          {onAddSshHost ? (
            <RunTargetRow
              icon={<Server className="size-3.5 shrink-0 text-muted-foreground" />}
              label={translate(
                'auto.components.NewWorkspaceComposerCard.addSshHost',
                'Add SSH host'
              )}
              detail={translate(
                'auto.components.NewWorkspaceComposerCard.addSshHostHint',
                'Use an existing machine over SSH'
              )}
              armed={hoveredKey === 'ssh'}
              current={false}
              stacked
              optionId={undefined}
              onArm={() => setHoveredKey('ssh')}
              onCommit={onAddSshHost}
            />
          ) : null}
          {onAddRemoteServer ? (
            <RunTargetRow
              icon={<Cloud className="size-3.5 shrink-0 text-muted-foreground" />}
              label={translate(
                'auto.components.NewWorkspaceComposerCard.addRemoteOrcaServer',
                'Add Remote Kondex Server'
              )}
              detail={translate(
                'auto.components.NewWorkspaceComposerCard.addRemoteOrcaServerHint',
                'Pair another Kondex runtime'
              )}
              armed={hoveredKey === 'remote'}
              current={false}
              stacked
              optionId={undefined}
              onArm={() => setHoveredKey('remote')}
              onCommit={onAddRemoteServer}
            />
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export { RUN_TARGET_ADD_HOST_KEY }
