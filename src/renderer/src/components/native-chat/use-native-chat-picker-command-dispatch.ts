import { useCallback, type Dispatch, type SetStateAction } from 'react'
import type { AgentType } from '../../../../shared/agent-status-types'
import { sendNativeChatMessage, sendNativeChatTypedCommand } from './native-chat-runtime-send'
import type { NativeChatResolvedTarget } from './native-chat-composer-target'
import {
  pushHistory,
  type HistoryState,
  type NativeChatPickerItem
} from './native-chat-composer-state'
import type { NativeChatSendLifecycle } from './use-native-chat-send-lifecycle'
import type { NativeChatPtySessionOptionsSurface } from './native-chat-pty-session-options'

export function useNativeChatPickerCommandDispatch(args: {
  agent: AgentType
  disabled: boolean
  isDispatchingSessionOption: boolean
  resolveTarget: () => NativeChatResolvedTarget | null
  onSlashCommand?: (command: string) => void
  sessionOptionsSurface: NativeChatPtySessionOptionsSurface | null
  trackPendingSend: NativeChatSendLifecycle['trackPendingSend']
  setHistory: Dispatch<SetStateAction<HistoryState>>
  setDraft: (value: string) => void
  setCaret: Dispatch<SetStateAction<number>>
  setActiveSuggestion: Dispatch<SetStateAction<number>>
  clearSkillOrigin: () => void
  clearImageAttachments: () => void
  setNotice: Dispatch<SetStateAction<string | null>>
}): (command: Extract<NativeChatPickerItem, { kind: 'command' }>) => void {
  const {
    agent,
    disabled,
    isDispatchingSessionOption,
    resolveTarget,
    onSlashCommand,
    sessionOptionsSurface,
    trackPendingSend,
    setHistory,
    setDraft,
    setCaret,
    setActiveSuggestion,
    clearSkillOrigin,
    clearImageAttachments,
    setNotice
  } = args
  return useCallback(
    (command) => {
      const text = `/${command.name}`
      const target = resolveTarget()
      if (!target || disabled || isDispatchingSessionOption) {
        return
      }
      trackPendingSend(
        agent === 'codex'
          ? sendNativeChatTypedCommand(target.settings, target.ptyId, text)
          : sendNativeChatMessage(target.settings, target.ptyId, text)
      )
      onSlashCommand?.(text)
      sessionOptionsSurface?.recordOutgoingCommand(text)
      setHistory((previous) => pushHistory(previous, text))
      setDraft('')
      setCaret(0)
      setActiveSuggestion(0)
      clearSkillOrigin()
      clearImageAttachments()
      setNotice(null)
    },
    [
      agent,
      clearImageAttachments,
      clearSkillOrigin,
      disabled,
      isDispatchingSessionOption,
      onSlashCommand,
      resolveTarget,
      sessionOptionsSurface,
      setActiveSuggestion,
      setCaret,
      setDraft,
      setHistory,
      setNotice,
      trackPendingSend
    ]
  )
}
