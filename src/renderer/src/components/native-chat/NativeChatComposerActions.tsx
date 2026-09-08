import { ArrowUp, Plus, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import type {
  SessionOptionDescriptor,
  SessionOptionsSurface
} from '../../../../shared/native-chat-session-options'
import { NativeChatSessionOptionPickers } from './NativeChatSessionOptionPickers'
import type { NativeChatOptionPickerRequest } from './native-chat-composer-types'

export type NativeChatComposerActionsProps = {
  attachDisabled: boolean
  sendDisabled: boolean
  isWorking: boolean
  onAttach: () => void
  onSend: () => void
  onStop?: () => void
  sessionOptionsSurface: SessionOptionsSurface | null
  sessionOptionsSnapshot: SessionOptionDescriptor[]
  sessionOptionsPickerRequest?: NativeChatOptionPickerRequest | null
}

export function NativeChatComposerActions({
  attachDisabled,
  sendDisabled,
  isWorking,
  onAttach,
  onSend,
  onStop,
  sessionOptionsSurface,
  sessionOptionsSnapshot,
  sessionOptionsPickerRequest
}: NativeChatComposerActionsProps): React.JSX.Element {
  const handleCriticalAction = (event: React.MouseEvent<HTMLButtonElement>): void => {
    // A double-click commonly lands after the first send has started and the button has
    // changed to Stop; ignore the second click instead of cancelling the new turn.
    if (event.detail > 1) {
      return
    }
    if (isWorking) {
      onStop?.()
    } else {
      onSend()
    }
  }
  return (
    <div className="flex w-full items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={translate('components.native-chat.composer.attach', 'Attach file')}
              disabled={attachDisabled}
              onClick={onAttach}
              className="pointer-coarse:size-11"
            >
              <Plus className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={4}>
            {translate('components.native-chat.composer.attach', 'Attach file')}
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        {/* Why: keep session controls beside the actions they affect. */}
        <NativeChatSessionOptionPickers
          surface={sessionOptionsSurface}
          snapshot={sessionOptionsSnapshot}
          isWorking={isWorking}
          pickerRequest={sessionOptionsPickerRequest}
        />
        <Button
          type="button"
          data-native-chat-critical-action={isWorking ? 'stop' : undefined}
          aria-label={
            isWorking
              ? translate('components.native-chat.stop', 'Stop the agent')
              : translate('components.native-chat.composer.send', 'Send')
          }
          disabled={sendDisabled}
          onClick={handleCriticalAction}
          variant={isWorking ? 'secondary' : 'default'}
          size="icon"
          className="size-8 rounded-full pointer-coarse:size-10"
        >
          {isWorking ? (
            <Square className="size-3.5 fill-current" />
          ) : (
            <ArrowUp className="size-4" />
          )}
        </Button>
      </div>
    </div>
  )
}
