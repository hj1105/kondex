import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDefaultSettings } from '../../../../shared/constants'
import { createTestStore, makeWorktree } from './store-test-helpers'

const worktreeActivation = vi.hoisted(() => ({
  activateAndRevealWorktree: vi.fn()
}))

vi.mock('../../lib/worktree-activation', () => ({
  activateAndRevealWorktree: worktreeActivation.activateAndRevealWorktree
}))

const reposAdd = vi.fn()
const worktreesList = vi.fn()

beforeEach(() => {
  reposAdd.mockReset()
  worktreesList.mockReset()
  worktreeActivation.activateAndRevealWorktree.mockReset()
  vi.stubGlobal('window', {
    api: {
      repos: { add: reposAdd },
      worktrees: { list: worktreesList }
    }
  })
})

afterEach(() => vi.unstubAllGlobals())

describe('repo slice folder startup without onboarding', () => {
  it('opens both folders without silently launching the preferred agent', async () => {
    reposAdd
      .mockResolvedValueOnce({
        repo: { id: 'folder-1', path: '/first', displayName: 'First', addedAt: 1 }
      })
      .mockResolvedValueOnce({
        repo: { id: 'folder-2', path: '/second', displayName: 'Second', addedAt: 2 }
      })
    worktreesList.mockImplementation(({ repoId }: { repoId: string }) => [
      makeWorktree({ id: `${repoId}::/folder`, repoId })
    ])
    const store = createTestStore()
    store.setState({
      settings: {
        ...getDefaultSettings('/tmp/kondex-workspaces'),
        defaultTuiAgent: 'codex'
      }
    })

    await store.getState().addNonGitFolder('/first')
    await store.getState().addNonGitFolder('/second')

    expect(worktreeActivation.activateAndRevealWorktree).toHaveBeenNthCalledWith(
      1,
      'folder-1::/folder',
      {
        sidebarRevealBehavior: 'auto'
      }
    )
    expect(worktreeActivation.activateAndRevealWorktree).toHaveBeenNthCalledWith(
      2,
      'folder-2::/folder',
      { sidebarRevealBehavior: 'auto' }
    )
    expect(worktreeActivation.activateAndRevealWorktree).toHaveBeenCalledTimes(2)
  })
})
