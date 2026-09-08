import { describe, expect, it, vi } from 'vitest'

const {
  callMock,
  runtimeClientConstructorMock,
  serveOrcaAppMock,
  getDefaultUserDataPathMock,
  addEnvironmentFromPairingCodeMock,
  listEnvironmentsMock,
  spawnMock
} = vi.hoisted(() => ({
  callMock: vi.fn(),
  runtimeClientConstructorMock: vi.fn(),
  serveOrcaAppMock: vi.fn(),
  getDefaultUserDataPathMock: vi.fn(() => '/tmp/orca-user-data'),
  addEnvironmentFromPairingCodeMock: vi.fn(),
  listEnvironmentsMock: vi.fn(),
  spawnMock: vi.fn()
}))

vi.mock('./runtime-client', async () => {
  const { createRuntimeClientModuleMock } = await import('./index-test-harness.js')
  return createRuntimeClientModuleMock({
    callMock,
    runtimeClientConstructorMock,
    serveOrcaAppMock,
    getDefaultUserDataPathMock
  })
})

vi.mock('./runtime/environments', () => ({
  addEnvironmentFromPairingCode: addEnvironmentFromPairingCodeMock,
  listEnvironments: listEnvironmentsMock,
  removeEnvironment: vi.fn(),
  resolveEnvironment: vi.fn()
}))

vi.mock('child_process', async () => {
  const { createChildProcessModuleMock } = await import('./index-test-harness.js')
  return createChildProcessModuleMock(spawnMock)
})

import { main } from './index'
import { buildWorktree, okFixture, queueFixtures, worktreeListFixture } from './test-fixtures'
import { useWorktreeAwarenessEnvironment } from './index-test-harness'

describe('orca cli worktree awareness', () => {
  useWorktreeAwarenessEnvironment({
    callMock,
    serveOrcaAppMock,
    getDefaultUserDataPathMock,
    addEnvironmentFromPairingCodeMock,
    listEnvironmentsMock,
    spawnMock
  })

  it('uses cwd when active is passed to worktree.set', async () => {
    queueFixtures(
      callMock,
      worktreeListFixture([
        buildWorktree('/tmp/repo', 'main', 'aaa'),
        buildWorktree('/tmp/repo/feature', 'feature/foo')
      ]),
      okFixture('req_1', {
        worktree: {
          id: 'repo::/tmp/repo/feature',
          branch: 'feature/foo',
          path: '/tmp/repo/feature',
          comment: 'hello'
        }
      })
    )
    vi.spyOn(console, 'log').mockImplementation(() => {})

    await main(
      ['worktree', 'set', '--worktree', 'active', '--comment', 'hello', '--json'],
      '/tmp/repo/feature/src'
    )

    expect(callMock).toHaveBeenNthCalledWith(2, 'worktree.set', {
      worktree: 'id:repo::/tmp/repo/feature',
      displayName: undefined,
      linkedIssue: undefined,
      comment: 'hello',
      parentWorktree: undefined,
      noParent: false
    })
  })

  it('passes parent lineage through worktree.set', async () => {
    queueFixtures(
      callMock,
      okFixture('req_set_parent', {
        worktree: {
          ...buildWorktree('/tmp/repo/child', 'feature/child'),
          parentWorktreeId: 'repo::/tmp/repo/parent',
          childWorktreeIds: [],
          lineage: {
            worktreeId: 'repo::/tmp/repo/child',
            worktreeInstanceId: 'child-instance',
            parentWorktreeId: 'repo::/tmp/repo/parent',
            parentWorktreeInstanceId: 'parent-instance',
            origin: 'manual',
            capture: { source: 'manual-action', confidence: 'explicit' },
            createdAt: 1
          }
        }
      })
    )
    vi.spyOn(console, 'log').mockImplementation(() => {})

    await main(
      [
        'worktree',
        'set',
        '--worktree',
        'id:repo::/tmp/repo/child',
        '--parent-worktree',
        'id:repo::/tmp/repo/parent',
        '--json'
      ],
      '/tmp/repo'
    )

    expect(callMock).toHaveBeenCalledWith('worktree.set', {
      worktree: 'id:repo::/tmp/repo/child',
      displayName: undefined,
      linkedIssue: undefined,
      comment: undefined,
      parentWorktree: 'id:repo::/tmp/repo/parent',
      noParent: false
    })
  })

  it('resolves current for explicit parent-worktree on set', async () => {
    queueFixtures(
      callMock,
      worktreeListFixture([buildWorktree('/tmp/repo/parent', 'feature/parent')]),
      okFixture('req_set_parent', {
        worktree: {
          ...buildWorktree('/tmp/repo/child', 'feature/child'),
          parentWorktreeId: 'repo::/tmp/repo/parent',
          childWorktreeIds: [],
          lineage: null
        }
      })
    )
    vi.spyOn(console, 'log').mockImplementation(() => {})

    await main(
      [
        'worktree',
        'set',
        '--worktree',
        'id:repo::/tmp/repo/child',
        '--parent-worktree',
        'current',
        '--json'
      ],
      '/tmp/repo/parent/src'
    )

    expect(callMock).toHaveBeenNthCalledWith(2, 'worktree.set', {
      worktree: 'id:repo::/tmp/repo/child',
      displayName: undefined,
      linkedIssue: undefined,
      comment: undefined,
      parentWorktree: 'id:repo::/tmp/repo/parent',
      noParent: false
    })
  })

  it('rejects contradictory parent flags on worktree.set before resolving selectors', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const priorExitCode = process.exitCode

    await main(
      [
        'worktree',
        'set',
        '--worktree',
        'id:repo::/tmp/repo/child',
        '--parent-worktree',
        'current',
        '--no-parent',
        '--json'
      ],
      '/tmp/not-managed'
    )

    expect(callMock).not.toHaveBeenCalled()
    expect([...logSpy.mock.calls, ...errSpy.mock.calls].flat().join('\n')).toContain(
      'Choose either --parent-worktree or --no-parent, not both.'
    )
    expect(process.exitCode).toBe(1)

    process.exitCode = priorExitCode
  })

  it('rejects bare parent-worktree on worktree.set', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const priorExitCode = process.exitCode

    await main(
      ['worktree', 'set', '--worktree', 'id:repo::/tmp/repo/child', '--parent-worktree', '--json'],
      '/tmp/repo'
    )

    expect(callMock).not.toHaveBeenCalled()
    expect([...logSpy.mock.calls, ...errSpy.mock.calls].flat().join('\n')).toContain(
      'Missing required --parent-worktree'
    )
    expect(process.exitCode).toBe(1)

    process.exitCode = priorExitCode
  })

  it('passes parent removal through worktree.set', async () => {
    queueFixtures(
      callMock,
      okFixture('req_clear_parent', {
        worktree: {
          ...buildWorktree('/tmp/repo/child', 'feature/child'),
          parentWorktreeId: null,
          childWorktreeIds: [],
          lineage: null
        }
      })
    )
    vi.spyOn(console, 'log').mockImplementation(() => {})

    await main(
      ['worktree', 'set', '--worktree', 'id:repo::/tmp/repo/child', '--no-parent', '--json'],
      '/tmp/repo'
    )

    expect(callMock).toHaveBeenCalledWith('worktree.set', {
      worktree: 'id:repo::/tmp/repo/child',
      displayName: undefined,
      linkedIssue: undefined,
      comment: undefined,
      workspaceStatus: undefined,
      parentWorktree: undefined,
      noParent: true
    })
  })

  it.each(['https://linear.app/stably/issue/STA-335/test-issue', 'null', 'not-a-linear-link'])(
    'rejects retired Linear issue value %s before any RPC',
    async (value) => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const priorExitCode = process.exitCode
      try {
        await main(
          [
            'worktree',
            'set',
            '--worktree',
            'id:repo::/tmp/repo/child',
            '--linear-issue',
            value,
            '--json'
          ],
          '/tmp/repo'
        )

        expect(callMock).not.toHaveBeenCalled()
        expect([...logSpy.mock.calls, ...errSpy.mock.calls].flat().join('\n')).toContain(
          'Unknown flag --linear-issue'
        )
        expect(process.exitCode).toBe(1)
      } finally {
        process.exitCode = priorExitCode
      }
    }
  )

  it('passes workspace status through worktree.set', async () => {
    queueFixtures(
      callMock,
      okFixture('req_set_status', {
        worktree: {
          ...buildWorktree('/tmp/repo/child', 'feature/child'),
          workspaceStatus: 'in-review'
        }
      })
    )
    vi.spyOn(console, 'log').mockImplementation(() => {})

    await main(
      [
        'worktree',
        'set',
        '--worktree',
        'id:repo::/tmp/repo/child',
        '--workspace-status',
        'in-review',
        '--json'
      ],
      '/tmp/repo'
    )

    expect(callMock).toHaveBeenCalledWith('worktree.set', {
      worktree: 'id:repo::/tmp/repo/child',
      displayName: undefined,
      linkedIssue: undefined,
      comment: undefined,
      workspaceStatus: 'in-review',
      parentWorktree: undefined,
      noParent: false
    })
  })
})
