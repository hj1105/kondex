import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Page } from '@stablyai/playwright-test'
import type { WorktreeRemovalTarget } from '../../../src/shared/worktree/removal'
import { removeWorktreeViaStore } from './dead-terminal'

const page = {
  evaluate: async (callback: (id: string) => Promise<void>, id: string) => callback(id)
} as unknown as Page

function installRows(rows: { id: string; hostId?: WorktreeRemovalTarget['executionHostId'] }[]) {
  const removeWorktree = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('window', {
    __store: { getState: () => ({ allWorktrees: () => rows, removeWorktree }) }
  })
  return removeWorktree
}

afterEach(() => vi.unstubAllGlobals())

describe('dead-terminal fixture cleanup ownership', () => {
  it.each(['local', 'ssh:fixture', 'runtime:fixture'] as const)(
    'forwards the observed %s owner without substituting the active host',
    async (hostId) => {
      const remove = installRows([{ id: 'wt-1', hostId }])
      await removeWorktreeViaStore(page, 'wt-1')
      expect(remove).toHaveBeenCalledExactlyOnceWith({ id: 'wt-1', executionHostId: hostId }, true)
    }
  )

  it('does not pick a host when the same locator exists on two hosts', async () => {
    const remove = installRows([
      { id: 'wt-1', hostId: 'local' },
      { id: 'wt-1', hostId: 'ssh:fixture' }
    ])
    await removeWorktreeViaStore(page, 'wt-1')
    expect(remove).not.toHaveBeenCalled()
  })

  it('does not invent a row or host for an absent workspace', async () => {
    const remove = installRows([{ id: 'other', hostId: 'local' }])
    await removeWorktreeViaStore(page, 'wt-1')
    expect(remove).not.toHaveBeenCalled()
  })

  it('preserves an explicitly legacy row with no host evidence', async () => {
    const remove = installRows([{ id: 'wt-1' }])
    await removeWorktreeViaStore(page, 'wt-1')
    expect(remove).toHaveBeenCalledExactlyOnceWith({ id: 'wt-1', executionHostId: null }, true)
  })
})
