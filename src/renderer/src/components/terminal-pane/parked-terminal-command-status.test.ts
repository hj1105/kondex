import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentStatusEntry } from '../../../../shared/agent-status-types'

const PTY_ID_LOCAL = 'pty-1'
const PTY_ID_SSH = 'ssh:target-1@@pty-9'
const WORKTREE_ID = 'repo-1::/tmp/wt-1'
const PANE_KEY = 'tab-1:11111111-1111-4111-8111-111111111111'

const dispatchTerminalCommandFinishedEvent = vi.fn()
let mockStoreState: {
  agentStatusByPaneKey: Record<string, AgentStatusEntry | undefined>
  dropAgentStatus: ReturnType<typeof vi.fn>
  clearAgentLaunchConfig: ReturnType<typeof vi.fn>
}

vi.mock('@/store', () => ({
  useAppStore: { getState: () => mockStoreState }
}))
vi.mock('@/hooks/terminal-command-finished-event', () => ({
  dispatchTerminalCommandFinishedEvent
}))

async function createPolicy(ptyId: string) {
  const { createParkedTerminalCommandStatusPolicy } =
    await import('./parked-terminal-command-status')
  return createParkedTerminalCommandStatusPolicy({
    ptyId,
    worktreeId: WORKTREE_ID,
    paneKey: PANE_KEY
  })
}

describe('createParkedTerminalCommandStatusPolicy', () => {
  beforeEach(() => {
    vi.resetModules()
    dispatchTerminalCommandFinishedEvent.mockClear()
    mockStoreState = {
      agentStatusByPaneKey: {},
      dropAgentStatus: vi.fn(),
      clearAgentLaunchConfig: vi.fn()
    }
  })

  it('nudges git UI on command finished for every PTY class', async () => {
    const local = await createPolicy(PTY_ID_LOCAL)
    const ssh = await createPolicy(PTY_ID_SSH)
    local.onCommandFinished(0)
    ssh.onCommandFinished(0)
    expect(dispatchTerminalCommandFinishedEvent).toHaveBeenCalledTimes(2)
    expect(dispatchTerminalCommandFinishedEvent).toHaveBeenCalledWith(WORKTREE_ID, 0)
  })

  it('drops a same-turn status row on command finished for SSH PTYs only', async () => {
    mockStoreState.agentStatusByPaneKey[PANE_KEY] = {
      state: 'working',
      prompt: 'build the feature',
      agentType: 'claude',
      updatedAt: 1000,
      stateStartedAt: 1000
    } as AgentStatusEntry
    const local = await createPolicy(PTY_ID_LOCAL)
    local.onCommandFinished(0)
    expect(mockStoreState.dropAgentStatus).not.toHaveBeenCalled()

    const ssh = await createPolicy(PTY_ID_SSH)
    ssh.onCommandFinished(0)
    expect(mockStoreState.dropAgentStatus).toHaveBeenCalledWith(PANE_KEY)
  })

  it('clears the launch registry on SSH completion without a status row', async () => {
    const ssh = await createPolicy(PTY_ID_SSH)
    ssh.onCommandFinished(0)
    expect(mockStoreState.clearAgentLaunchConfig).toHaveBeenCalledWith(PANE_KEY)
  })

  it('does nothing after dispose', async () => {
    const ssh = await createPolicy(PTY_ID_SSH)
    ssh.dispose()
    ssh.onCommandFinished(0)
    expect(dispatchTerminalCommandFinishedEvent).not.toHaveBeenCalled()
  })
})
