import { describe, expect, it, vi } from 'vitest'
import type { Repo } from '../../shared/repo-types'

const mocks = vi.hoisted(() => ({
  markCodexProjectTrusted: vi.fn(),
  detectRemoteAgents: vi.fn(),
  detectInstalledAgentsWithShellPathHydration: vi.fn()
}))

vi.mock('../agent-trust-presets', () => ({
  markCodexProjectTrusted: mocks.markCodexProjectTrusted
}))

vi.mock('../preflight/agent-detection', () => ({
  detectRemoteAgents: mocks.detectRemoteAgents,
  detectInstalledAgentsWithShellPathHydration: mocks.detectInstalledAgentsWithShellPathHydration
}))

import {
  buildWorktreeStartupForDraft,
  markLocalWorktreeTrusted
} from './runtime-worktree-agent-startup'

function makeRepo(fields: Partial<Repo>): Repo {
  return {
    id: 'repo-1',
    name: 'repo',
    path: '/srv/repo',
    connectionId: null,
    executionHostId: null,
    ...fields
  } as Repo
}

const settings = {
  agentCmdOverrides: {},
  agentDefaultArgs: {},
  agentDefaultEnv: {},
  disabledTuiAgents: [],
  defaultTuiAgent: undefined,
  terminalWindowsShell: null
} as never

describe('buildWorktreeStartupForDraft agent detection', () => {
  it('probes the SSH host named only by executionHostId instead of this client', async () => {
    mocks.detectRemoteAgents.mockResolvedValueOnce(['claude'])
    mocks.detectInstalledAgentsWithShellPathHydration.mockResolvedValue([])

    const result = await buildWorktreeStartupForDraft({
      repo: makeRepo({ executionHostId: 'ssh:openclaw' }),
      settings,
      draft: 'ship it',
      getLaunchPlatform: () => 'linux'
    })

    expect(mocks.detectRemoteAgents).toHaveBeenCalledWith({ connectionId: 'openclaw' })
    expect(mocks.detectInstalledAgentsWithShellPathHydration).not.toHaveBeenCalled()
    expect(result?.agent).toBe('claude')
  })

  it('probes this client for a local row carrying a stale connection', async () => {
    mocks.detectRemoteAgents.mockClear()
    mocks.detectInstalledAgentsWithShellPathHydration.mockResolvedValueOnce(['claude'])

    const result = await buildWorktreeStartupForDraft({
      repo: makeRepo({ connectionId: 'm4air', executionHostId: 'local' }),
      settings,
      draft: 'ship it',
      getLaunchPlatform: () => 'linux'
    })

    expect(mocks.detectRemoteAgents).not.toHaveBeenCalled()
    expect(result?.agent).toBe('claude')
  })
})

describe('markLocalWorktreeTrusted', () => {
  it('waits for the Codex trust write before resolving', async () => {
    let finish!: () => void
    mocks.markCodexProjectTrusted.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve
      })
    )
    let settled = false
    const marking = markLocalWorktreeTrusted('codex', '/workspace/app').then(() => {
      settled = true
    })

    await Promise.resolve()
    expect(settled).toBe(false)
    finish()
    await marking
    expect(mocks.markCodexProjectTrusted).toHaveBeenCalledWith('/workspace/app')
  })

  it('contains a rejected Codex trust write', async () => {
    mocks.markCodexProjectTrusted.mockRejectedValueOnce(new Error('write failed'))

    await expect(markLocalWorktreeTrusted('codex', '/workspace/app')).resolves.toBeUndefined()
  })
})
