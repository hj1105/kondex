export type TerminalWithFocusMode = {
  textarea?: HTMLTextAreaElement | null
  modes?: {
    sendFocusMode?: boolean
  }
}

export function terminalHasFocusReportingEnabled(terminal: TerminalWithFocusMode): boolean {
  return terminal.modes?.sendFocusMode === true
}

export function terminalOwnsDomFocus(terminal: TerminalWithFocusMode): boolean {
  if (typeof document === 'undefined' || !terminal.textarea) {
    return false
  }
  return document.activeElement === terminal.textarea
}
