import { useCallback, useEffect } from 'react'
import type { ManagedPane, PaneManager } from '@/lib/pane-manager/pane-manager'
import type { PtyTransport } from './pty-transport'
import type { PaneCwdMap } from './resolve-split-cwd'
import {
  REQUEST_ACTIVE_TERMINAL_PANE_SPLIT_EVENT,
  type RequestActiveTerminalPaneSplitDetail
} from '@/constants/terminal'
import { splitTerminalPaneWithInheritedCwd } from './terminal-pane-split-with-inherited-cwd'

type UseTerminalPaneSplitActionsDeps = {
  managerRef: React.RefObject<PaneManager | null>
  paneTransportsRef: React.RefObject<Map<number, PtyTransport>>
  paneCwdRef: React.RefObject<PaneCwdMap>
  contextPaneIdRef: React.RefObject<number | null>
  tabId: string
  worktreeId: string
  fallbackCwd: string
  resolveMenuPane: () => ManagedPane | null
}

type TerminalPaneSplitActions = {
  onSplitRight: () => void
  onSplitDown: () => void
}

export function useTerminalPaneSplitActions({
  managerRef,
  paneTransportsRef,
  paneCwdRef,
  contextPaneIdRef,
  tabId,
  worktreeId,
  fallbackCwd,
  resolveMenuPane
}: UseTerminalPaneSplitActionsDeps): TerminalPaneSplitActions {
  const splitWithInheritedCwd = useCallback(
    (direction: 'vertical' | 'horizontal'): void => {
      const pane = resolveMenuPane()
      const manager = managerRef.current
      if (!pane || !manager) {
        return
      }
      splitTerminalPaneWithInheritedCwd({
        worktreeId,
        tabId,
        manager,
        getManager: () => managerRef.current,
        paneTransports: paneTransportsRef.current,
        paneCwdMap: paneCwdRef.current,
        fallbackCwd,
        pane,
        direction
      })
    },
    [fallbackCwd, managerRef, paneCwdRef, paneTransportsRef, resolveMenuPane, tabId, worktreeId]
  )

  const onSplitRight = (): void => splitWithInheritedCwd('vertical')
  const onSplitDown = (): void => splitWithInheritedCwd('horizontal')

  useEffect(() => {
    const onRequestSplit = (event: Event): void => {
      const detail = (event as CustomEvent<RequestActiveTerminalPaneSplitDetail>).detail
      if (detail?.tabId && detail.tabId !== tabId) {
        return
      }
      contextPaneIdRef.current = null
      splitWithInheritedCwd(detail?.direction ?? 'vertical')
    }
    window.addEventListener(REQUEST_ACTIVE_TERMINAL_PANE_SPLIT_EVENT, onRequestSplit)
    return () =>
      window.removeEventListener(REQUEST_ACTIVE_TERMINAL_PANE_SPLIT_EVENT, onRequestSplit)
    // splitWithInheritedCwd closes over live refs; re-registering keeps the
    // action aligned with the current focused pane and fallback cwd.
  }, [tabId, splitWithInheritedCwd, contextPaneIdRef])

  return { onSplitRight, onSplitDown }
}
