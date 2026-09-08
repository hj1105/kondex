import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { RuntimeGitTarget } from '../runtime/runtime-git-command-target'
import { OrcaRuntimeWithPersistHeadlessTerminalTitle } from '../runtime/orca-runtime-persist-headless-terminal-title'
import { kontextScheduleRepositoryPath } from './kontext-schedule-repository'

function target(overrides: Partial<RuntimeGitTarget> = {}): RuntimeGitTarget {
  return {
    worktree: { git: { path: '/host/Repository with spaces ' } } as RuntimeGitTarget['worktree'],
    executionHostId: 'local',
    ...overrides
  }
}

describe('Kontext schedule repository ownership', () => {
  it('uses the resolved execution-host path unchanged', () => {
    expect(kontextScheduleRepositoryPath(target())).toBe(resolve('/host/Repository with spaces '))
  })

  it.each(['ssh:target', 'runtime:environment'] as const)(
    'refuses a %s target without local fallback',
    (executionHostId) => {
      expect(() => kontextScheduleRepositoryPath(target({ executionHostId }))).toThrow(
        'local fallback is not allowed'
      )
    }
  )

  it('does not run a WSL path through the native sidecar', () => {
    expect(() =>
      kontextScheduleRepositoryPath(target({ localGitOptions: { wslDistro: 'Ubuntu' } }))
    ).toThrow('execution host')
  })

  it('resolves the existing host-qualified Git target instead of accepting a caller path', async () => {
    const resolveRuntimeGitTarget = vi.fn().mockResolvedValue(target())
    const result = await Reflect.apply(
      OrcaRuntimeWithPersistHeadlessTerminalTitle.prototype.resolveKontextScheduleRepository,
      { resolveRuntimeGitTarget },
      ['workspace-selector']
    )
    expect(result).toBe(resolve('/host/Repository with spaces '))
    expect(resolveRuntimeGitTarget).toHaveBeenCalledExactlyOnceWith('workspace-selector')
  })

  it('preserves unknown/folder/unreachable target failures', async () => {
    const error = new Error('worktree_execution_host_unresolved')
    await expect(
      Reflect.apply(
        OrcaRuntimeWithPersistHeadlessTerminalTitle.prototype.resolveKontextScheduleRepository,
        { resolveRuntimeGitTarget: vi.fn().mockRejectedValue(error) },
        ['unknown-folder']
      )
    ).rejects.toBe(error)
  })
})
