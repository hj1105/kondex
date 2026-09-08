/**
 * Store-level command lifecycle handling retained while a terminal pane is parked.
 * Pane-coupled foreground and interrupt inference stays with the mounted pane.
 */
import type { AgentStatusEntry } from '../../../../shared/agent-status-types'
import { parseAppSshPtyId } from '../../../../shared/ssh-pty-id'
import { dispatchTerminalCommandFinishedEvent } from '@/hooks/terminal-command-finished-event'
import { useAppStore } from '@/store'

export type ParkedTerminalCommandStatusPolicy = {
  onCommandFinished: (bestEffortExitCode: number | null) => void
  dispose: () => void
}

export function createParkedTerminalCommandStatusPolicy(options: {
  ptyId: string
  worktreeId: string
  paneKey: string
}): ParkedTerminalCommandStatusPolicy {
  const { ptyId, worktreeId, paneKey } = options
  let disposed = false

  const dropCommandFinishedStatusIfSameTurn = (entry: AgentStatusEntry | undefined): void => {
    const state = useAppStore.getState()
    if (!entry) {
      state.clearAgentLaunchConfig(paneKey)
      return
    }
    const current = state.agentStatusByPaneKey[paneKey]
    if (!current) {
      state.clearAgentLaunchConfig(paneKey)
      return
    }
    const unchanged =
      current.state === entry.state &&
      current.prompt === entry.prompt &&
      current.updatedAt === entry.updatedAt &&
      current.stateStartedAt === entry.stateStartedAt &&
      current.agentType === entry.agentType
    if (unchanged) {
      state.dropAgentStatus(paneKey)
    }
  }

  return {
    onCommandFinished: (bestEffortExitCode: number | null): void => {
      if (disposed) {
        return
      }
      dispatchTerminalCommandFinishedEvent(worktreeId, bestEffortExitCode)
      if (parseAppSshPtyId(ptyId) === null) {
        return
      }
      dropCommandFinishedStatusIfSameTurn(useAppStore.getState().agentStatusByPaneKey[paneKey])
    },
    dispose: (): void => {
      disposed = true
    }
  }
}
