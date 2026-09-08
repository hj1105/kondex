import { describe, expect, it } from 'vitest'
import { resolveTerminalOrchestrationCliCommand } from './cli-command'

describe('resolveTerminalOrchestrationCliCommand', () => {
  it('uses kondex for a pane recorded as WSL', () => {
    expect(
      resolveTerminalOrchestrationCliCommand({
        connectionId: null,
        isWsl: true,
        worktreeId: 'repo::C:\\repo'
      })
    ).toBe('kondex')
  })

  it('uses project runtime and WSL paths when restored pane metadata is unavailable', () => {
    expect(
      resolveTerminalOrchestrationCliCommand({
        connectionId: null,
        isWsl: null,
        worktreeId: 'repo::C:\\repo',
        projectRuntime: {
          status: 'resolved',
          runtime: {
            kind: 'wsl',
            hostPlatform: 'wsl',
            projectId: 'project',
            distro: 'Ubuntu',
            reason: 'project-override',
            cacheKey: 'project:wsl:Ubuntu'
          }
        }
      })
    ).toBe('kondex')
    expect(
      resolveTerminalOrchestrationCliCommand({
        connectionId: null,
        isWsl: null,
        worktreeId: 'repo::\\\\wsl.localhost\\Ubuntu\\home\\alice\\repo'
      })
    ).toBe('kondex')
  })

  it('uses Kondex locally and preserves the explicit SSH compatibility shim', () => {
    expect(
      resolveTerminalOrchestrationCliCommand({
        connectionId: null,
        isWsl: false,
        worktreeId: 'repo::/home/alice/repo'
      })
    ).toBe('kondex')
    expect(
      resolveTerminalOrchestrationCliCommand({
        connectionId: 'ssh-1',
        isWsl: null,
        worktreeId: 'repo::\\\\wsl.localhost\\Ubuntu\\home\\alice\\repo'
      })
    ).toBe('orca')
  })
})
