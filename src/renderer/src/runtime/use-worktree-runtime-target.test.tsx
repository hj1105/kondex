// @vitest-environment happy-dom
import { act } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { useWorktreeRuntimeTarget } from './use-worktree-runtime-target'

vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  return {
    useAppStore: create(() => ({ activeRepoId: null as string | null, settingsSearchQuery: '' }))
  }
})
vi.mock('@/lib/worktree-runtime-owner', () => ({
  getExecutionHostIdForWorktree: (state: { activeRepoId: string | null }) =>
    state.activeRepoId ?? 'local'
}))

const observed: unknown[] = []
function Probe() {
  const target = useWorktreeRuntimeTarget(null)
  observed.push(target)
  return <span data-testid="runtime-target">{JSON.stringify(target)}</span>
}
beforeEach(() => {
  useAppStore.setState({ activeRepoId: null, settingsSearchQuery: '' })
  observed.length = 0
})
afterEach(cleanup)

describe('worktree runtime target subscription', () => {
  it('keeps a stable local snapshot without a project and ignores unrelated store changes', () => {
    render(<Probe />)
    expect(screen.getByTestId('runtime-target').textContent).toBe('{"kind":"local"}')
    const renderCount = observed.length
    act(() => useAppStore.setState({ settingsSearchQuery: 'unrelated change' }))
    expect(observed).toHaveLength(renderCount)
  })
  it('updates when ownership changes and returns null for direct SSH', () => {
    render(<Probe />)
    act(() => useAppStore.setState({ activeRepoId: 'runtime:peer' }))
    expect(screen.getByTestId('runtime-target').textContent).toBe(
      '{"kind":"environment","environmentId":"peer"}'
    )
    const renderCount = observed.length
    act(() => useAppStore.setState({ settingsSearchQuery: 'still unrelated' }))
    expect(observed).toHaveLength(renderCount)
    act(() => useAppStore.setState({ activeRepoId: 'ssh:server' }))
    expect(screen.getByTestId('runtime-target').textContent).toBe('null')
  })
})
