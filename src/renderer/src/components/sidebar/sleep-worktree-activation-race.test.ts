import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const state = {
    activeWorktreeId: null as string | null,
    setActiveWorktree: vi.fn((worktreeId: string | null) => {
      state.activeWorktreeId = worktreeId
    }),
    shutdownWorktreeBrowsers: vi.fn().mockResolvedValue(undefined),
    shutdownWorktreeTerminals: vi.fn(async (worktreeId: string) => {
      for (const tab of state.tabsByWorktree[worktreeId] ?? []) {
        state.ptyIdsByTabId[tab.id] = []
      }
    }),
    tabsByWorktree: {} as Record<string, { id: string }[]>,
    ptyIdsByTabId: {} as Record<string, string[]>
  }
  const activateAndRevealWorktree = vi.fn()
  const activateAndRevealFolderWorkspace = vi.fn()
  return {
    activateAndRevealFolderWorkspace,
    activateAndRevealWorktree,
    state,
    toastError: vi.fn()
  }
})

vi.mock('@/store', () => ({
  useAppStore: {
    getState: () => mocks.state
  }
}))

vi.mock('@/lib/worktree-activation', () => ({
  activateAndRevealFolderWorkspace: mocks.activateAndRevealFolderWorkspace,
  activateAndRevealWorktree: mocks.activateAndRevealWorktree
}))

vi.mock('sonner', () => ({ toast: { error: mocks.toastError } }))

import { activateWorktreeFromSidebar } from '@/lib/sidebar-worktree-activation'
import { runSleepWorktrees } from './sleep-worktree-flow'

describe('sleep flow vs slept-workspace activation', () => {
  beforeEach(() => {
    mocks.activateAndRevealWorktree.mockClear().mockImplementation((worktreeId: string) => {
      mocks.state.setActiveWorktree(worktreeId)
    })
    mocks.activateAndRevealFolderWorkspace.mockClear()
    mocks.toastError.mockClear()
    vi.stubGlobal('window', { api: {} })
    mocks.state.activeWorktreeId = 'wt-parent'
    mocks.state.setActiveWorktree.mockClear()
    mocks.state.shutdownWorktreeBrowsers.mockClear().mockResolvedValue(undefined)
    mocks.state.shutdownWorktreeTerminals.mockClear().mockImplementation(async (worktreeId) => {
      for (const tab of mocks.state.tabsByWorktree[worktreeId] ?? []) {
        mocks.state.ptyIdsByTabId[tab.id] = []
      }
    })
    mocks.state.tabsByWorktree = {
      'wt-parent': [{ id: 'tab-parent' }],
      'wt-child-1': [{ id: 'tab-child-1' }],
      'wt-child-2': [{ id: 'tab-child-2' }],
      'wt-child-3': [{ id: 'tab-child-3' }]
    }
    mocks.state.ptyIdsByTabId = {
      'tab-parent': ['pty-parent'],
      'tab-child-1': ['pty-child-1'],
      'tab-child-2': ['pty-child-2'],
      'tab-child-3': ['pty-child-3']
    }
  })

  afterEach(() => vi.unstubAllGlobals())

  it('does not leave behind a delayed parent activation after sleeping children', async () => {
    await runSleepWorktrees(['wt-parent'])

    expect(mocks.state.activeWorktreeId).toBeNull()
    expect(mocks.state.ptyIdsByTabId['tab-parent']).toEqual([])

    await activateWorktreeFromSidebar('wt-parent')
    expect(mocks.activateAndRevealWorktree).toHaveBeenCalledTimes(1)
    expect(mocks.activateAndRevealWorktree).toHaveBeenCalledWith('wt-parent', {
      revealInSidebar: false
    })

    await runSleepWorktrees(['wt-child-1', 'wt-child-2', 'wt-child-3'])

    expect(mocks.activateAndRevealWorktree).toHaveBeenCalledTimes(1)
    expect(mocks.state.activeWorktreeId).toBe('wt-parent')
  })

  it('keeps the selected parent visible when a pending child shutdown fails', async () => {
    let rejectShutdown!: (error: Error) => void
    mocks.state.shutdownWorktreeBrowsers.mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        rejectShutdown = reject
      })
    )
    const sleeping = runSleepWorktrees(['wt-child-1'])

    await activateWorktreeFromSidebar('wt-parent')
    rejectShutdown(new Error('connection lost'))
    await sleeping

    expect(mocks.state.activeWorktreeId).toBe('wt-parent')
    expect(mocks.activateAndRevealWorktree).toHaveBeenCalledTimes(1)
    expect(mocks.activateAndRevealWorktree).toHaveBeenCalledWith('wt-parent', {
      revealInSidebar: false
    })
    expect(mocks.toastError).toHaveBeenCalledWith(
      'Failed to sleep workspace',
      expect.objectContaining({
        description: expect.stringContaining('could not confirm terminal shutdown')
      })
    )
    expect(mocks.state.shutdownWorktreeTerminals).not.toHaveBeenCalled()
  })
})
