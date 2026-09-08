import React from 'react'
import { Command } from '@/components/ui/command'
import { Popover, PopoverAnchor } from '@/components/ui/popover'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { translate } from '@/i18n/i18n'
import { WorkspaceEmojiSuggestionPopover } from '@/components/workspace-emoji/WorkspaceEmojiSuggestionPopover'
import { renderSmartWorkspaceCrossRepoDialog } from './smart-workspace-cross-repo-dialog'
import { renderSmartWorkspaceNameInput } from './smart-workspace-name-input-surface'
import { renderSmartWorkspaceSourceResults } from './smart-workspace-source-results-surface'
import type { SmartWorkspaceNameFieldController } from './use-smart-workspace-name-field-controller'

export function renderSmartWorkspaceNameField(
  controller: SmartWorkspaceNameFieldController
): React.JSX.Element {
  const {
    textOnly,
    mode,
    onActiveSourceModeChange,
    setMode,
    disabled,
    selectedSource,
    markSourcePopoverUserEngaged,
    setOpen,
    cancelLocalInputFocusFrame,
    localInputFocusFrameRef,
    localInputRef,
    tabsListRef,
    availableModes,
    open,
    handleSourcePopoverOpenChange,
    resolvedCommandValue,
    isQueryStale,
    setCommandValue,
    emojiMenuOpen,
    resolvedEmojiCommandValue,
    emojiSuggestions,
    setEmojiCommandValue,
    handleEmojiSelect,
    setEmojiCursor
  } = controller

  return (
    <div className="min-w-0 space-y-1.5">
      {textOnly ? null : (
        <div className="flex min-w-0 items-center gap-2 border-b border-border/40">
          <Tabs
            value={mode}
            onValueChange={(next) => {
              const nextMode = next as typeof mode
              onActiveSourceModeChange?.(nextMode)
              setMode(nextMode)
              if (!disabled && nextMode !== 'text' && selectedSource === null) {
                markSourcePopoverUserEngaged()
                setOpen(true)
              } else {
                setOpen(false)
              }
              cancelLocalInputFocusFrame()
              localInputFocusFrameRef.current = requestAnimationFrame(() => {
                localInputFocusFrameRef.current = null
                localInputRef.current?.focus({ preventScroll: true })
              })
            }}
            className="min-w-0 flex-1 gap-0"
          >
            <TabsList
              ref={tabsListRef}
              variant="line"
              className="h-7 w-full justify-start gap-4 overflow-x-auto overflow-y-hidden px-0 scrollbar-sleek"
              onFocusCapture={(event) => {
                // Why: Radix roving focus races commits, so forward external Tab focus to the input.
                const previous = event.relatedTarget as HTMLElement | null
                const list = tabsListRef.current
                const input = localInputRef.current
                if (!list || !input) {
                  return
                }
                if (!previous || previous === input || list.contains(previous)) {
                  return
                }
                event.stopPropagation()
                input.focus({ preventScroll: true })
              }}
            >
              {availableModes.map(({ id, label, Icon }) => (
                <TabsTrigger
                  key={id}
                  value={id}
                  tabIndex={-1}
                  data-smart-name-mode={id}
                  className="flex-none gap-1.5 px-0 text-xs"
                >
                  <Icon className="size-3.5" />
                  <span>{label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      )}
      <Popover
        open={!disabled && open && mode !== 'text' && selectedSource === null}
        onOpenChange={handleSourcePopoverOpenChange}
      >
        <Command
          value={resolvedCommandValue}
          onValueChange={(next) => {
            // Why: cmdk re-emits when rows reshape; freeze it while debounce trails input.
            if (isQueryStale) {
              return
            }
            setCommandValue(next)
          }}
          shouldFilter={false}
          className="overflow-visible bg-transparent"
        >
          <PopoverAnchor asChild>
            <div className="relative min-w-0">{renderSmartWorkspaceNameInput(controller)}</div>
          </PopoverAnchor>
          {renderSmartWorkspaceSourceResults(controller)}
        </Command>
      </Popover>
      <WorkspaceEmojiSuggestionPopover
        anchorRef={localInputRef}
        open={emojiMenuOpen}
        commandValue={resolvedEmojiCommandValue}
        heading={translate('auto.components.new.workspace.SmartWorkspaceNameField.emoji', 'Emoji')}
        suggestions={emojiSuggestions}
        onCommandValueChange={setEmojiCommandValue}
        onSelect={handleEmojiSelect}
        onOpenChange={(next) => {
          if (!next) {
            setEmojiCursor(null)
          }
        }}
      />
      {renderSmartWorkspaceCrossRepoDialog(controller)}
    </div>
  )
}
