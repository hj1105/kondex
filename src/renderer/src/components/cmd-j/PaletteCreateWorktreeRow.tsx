import React, { useEffect, useState } from 'react'
import { Github, Gitlab, Plus } from 'lucide-react'
import { CommandItem } from '@/components/ui/command'
import { CREATE_WORKTREE_ITEM_ID } from '@/lib/worktree-palette-create-action'
import type { CmdJTaskUrlCreatePreview } from '@/lib/worktree-palette-task-url-match'
import { translate } from '@/i18n/i18n'

function TaskUrlProviderIcon({
  provider
}: {
  provider: CmdJTaskUrlCreatePreview['provider']
}): React.JSX.Element {
  if (provider === 'github') {
    return <Github className="size-3" aria-hidden="true" />
  }
  if (provider === 'gitlab') {
    return <Gitlab className="size-3" aria-hidden="true" />
  }
  return <Gitlab className="size-3" aria-hidden="true" />
}

export function PaletteCreateWorktreeRow({
  className,
  createWorktreeName,
  taskUrlPreview,
  onSelect
}: {
  className: string
  createWorktreeName: string
  taskUrlPreview: CmdJTaskUrlCreatePreview | null
  onSelect: () => void
}): React.JSX.Element {
  const previewLabel = taskUrlPreview?.createLabel ?? undefined
  const [showTaskUrlLoadingFeedback, setShowTaskUrlLoadingFeedback] = useState(false)
  useEffect(() => {
    if (!taskUrlPreview?.loading) {
      setShowTaskUrlLoadingFeedback(false)
      return
    }
    setShowTaskUrlLoadingFeedback(false)
    const timer = window.setTimeout(() => setShowTaskUrlLoadingFeedback(true), 200)
    return () => window.clearTimeout(timer)
  }, [taskUrlPreview?.identifier, taskUrlPreview?.loading])

  return (
    <CommandItem
      value={CREATE_WORKTREE_ITEM_ID}
      onSelect={onSelect}
      aria-label={previewLabel}
      aria-busy={Boolean(taskUrlPreview?.loading)}
      data-cmd-j-task-url-preview={taskUrlPreview ? 'true' : undefined}
      data-cmd-j-task-url-provider={taskUrlPreview?.provider}
      data-cmd-j-task-url-state={
        taskUrlPreview ? (taskUrlPreview.loading ? 'loading' : 'resolved') : undefined
      }
      className={className}
    >
      {taskUrlPreview ? (
        <>
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border/60 bg-muted/25 text-muted-foreground/70">
            <TaskUrlProviderIcon provider={taskUrlPreview.provider} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-baseline gap-2">
              <span className="shrink-0 font-mono text-[12px] font-semibold text-muted-foreground">
                {taskUrlPreview.identifier}
              </span>
              <span className="truncate text-[14px] font-semibold tracking-[-0.01em] text-foreground">
                {taskUrlPreview.subtitle}
              </span>
            </div>
            <div className="mt-0.5 truncate text-[12px] text-muted-foreground">
              {taskUrlPreview.loading && showTaskUrlLoadingFeedback
                ? translate('worktreeJumpPalette.taskUrl.loadingHint', 'Loading {{value0}}…', {
                    value0: taskUrlPreview.kindLabel
                  })
                : translate(
                    'worktreeJumpPalette.taskUrl.createHint',
                    'Create worktree from {{value0}}',
                    { value0: taskUrlPreview.kindLabel }
                  )}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-dashed border-border/60 bg-muted/25 text-muted-foreground/70">
            <Plus size={13} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold tracking-[-0.01em] text-foreground">
              {translate(
                'auto.components.WorktreeJumpPalette.95be6587d3',
                'Create worktree "{{value0}}"',
                { value0: createWorktreeName }
              )}
            </div>
          </div>
        </>
      )}
    </CommandItem>
  )
}
