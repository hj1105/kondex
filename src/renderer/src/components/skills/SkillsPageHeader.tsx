import { BookOpen, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import { skillCountLabel } from './skill-display-labels'
import { SKILLS_PAGE_COLUMN } from './skills-page-column'
import { SkillsSourcesPopover } from './SkillsSourcesPopover'
import type { SkillSourceInventoryEntry } from './skill-source-inventory'

export function SkillsPageHeader({
  skillCount,
  sourceEntries,
  scannedSourceCount,
  hostLabel,
  onClose,
  deleteSupported,
  deleteUnsupportedReason,
  onStartDelete
}: {
  skillCount: number
  sourceEntries: readonly SkillSourceInventoryEntry[]
  scannedSourceCount: number
  hostLabel: string | null
  onClose: () => void
  /** False while the target is unresolved or the host predates the delete
   *  capability, so the entry disables with a reason rather than routing a
   *  request nothing on that host answers. */
  deleteSupported: boolean
  deleteUnsupportedReason: string | null
  onStartDelete: () => void
}): React.JSX.Element {
  return (
    <header className="shrink-0 border-b border-border">
      <div className={cn(SKILLS_PAGE_COLUMN, 'flex items-center gap-2 py-3')}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 rounded-full"
              onClick={onClose}
              aria-label={translate(
                'auto.components.skills.SkillsPage.closeSkills',
                'Close skills'
              )}
            >
              <X className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            {translate('auto.components.skills.SkillsPage.closeTooltip', 'Close · Esc')}
          </TooltipContent>
        </Tooltip>
        <div className="mx-1 h-5 w-px bg-border/50" aria-hidden />
        <BookOpen className="size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold">
            {translate('auto.components.skills.SkillsPage.f43ad6edf3', 'Skills')}
          </h1>
          <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <span className="shrink-0">{skillCountLabel(skillCount)}</span>
            {sourceEntries.length > 0 ? (
              <>
                <span aria-hidden>·</span>
                <SkillsSourcesPopover entries={sourceEntries} scannedCount={scannedSourceCount} />
              </>
            ) : null}
            {hostLabel ? (
              <>
                <span aria-hidden>·</span>
                <span className="truncate">{hostLabel}</span>
              </>
            ) : null}
          </div>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="pointer-events-auto inline-flex">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={!deleteSupported}
                onClick={onStartDelete}
              >
                <Trash2 />
                {translate('auto.components.skills.SkillsPage.deleteSkills', 'Delete skills…')}
              </Button>
            </span>
          </TooltipTrigger>
          {deleteSupported || !deleteUnsupportedReason ? null : (
            <TooltipContent side="bottom" sideOffset={4}>
              {deleteUnsupportedReason}
            </TooltipContent>
          )}
        </Tooltip>
      </div>
    </header>
  )
}
