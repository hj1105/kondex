// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n/i18n'
import { taskInventoryFixture } from '../../../../shared/__fixtures__/kontext-task-inventory'
import { finalizationFixture as record } from '../../../../shared/__fixtures__/kontext-finalization'
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), revision: 1 }))
vi.mock('@/runtime/runtime-rpc-client', () => ({ callRuntimeRpc: mocks.rpc }))
vi.mock('@/runtime/runtime-environment-revision', () => ({
  getRuntimeEnvironmentRevision: () => mocks.revision
}))
import { KontextTaskInventory } from './KontextTaskInventory'
const owner = { kind: 'environment' as const, environmentId: 'host:one', pairingRevision: 1 }
const row = {
  ...taskInventoryFixture.tasks[0]!,
  taskId: record.request.taskId,
  latestSchedule: {
    ...taskInventoryFixture.tasks[0]!.latestSchedule!,
    taskId: record.request.taskId,
    jobId: record.request.jobId
  },
  integration: {
    jobId: record.request.jobId,
    gitCommit: record.gitCommit,
    createdAt: record.completedAt
  },
  finalization: {
    recordId: record.recordId,
    jobId: record.request.jobId,
    gitCommit: record.gitCommit,
    completedAt: record.completedAt
  }
}
beforeEach(async () => {
  mocks.revision = 1
  window.localStorage.clear()
  mocks.rpc.mockReset().mockImplementation(async (_owner, method) => {
    if (method === 'kontext.listTasks') {
      return { ...taskInventoryFixture, tasks: [row] }
    }
    if (method === 'kontext.inspectFinalization') {
      return { taskId: row.taskId, record, currentEvidence: 'not_revalidated' }
    }
    throw new Error('Unexpected fixture method')
  })
  await i18n.changeLanguage('en')
})
afterEach(() => {
  cleanup()
  window.localStorage.clear()
})
async function load() {
  fireEvent.click(screen.getByRole('button', { name: 'Load task list' }))
  return screen.findByRole('button', { name: `Open task: ${row.intent}` })
}
it('shows host history with an empty local journal, opens the exact Task and only reads completion explicitly', async () => {
  const select = vi.fn()
  render(<KontextTaskInventory owner={owner} disabled={false} onSelect={select} />)
  expect(mocks.rpc).not.toHaveBeenCalled()
  const open = await load()
  expect(screen.queryByText(/Recorded completion valid at observation/)).toBeNull()
  fireEvent.click(open)
  expect(select).toHaveBeenCalledExactlyOnceWith(row)
  expect(mocks.rpc).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('button', { name: 'Record Task completion' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Read completion record' }))
  await screen.findByText(/Completion recorded at:/)
  expect(mocks.rpc.mock.calls.at(-1)?.slice(1, 3)).toEqual([
    'kontext.inspectFinalization',
    { taskId: row.taskId }
  ])
  expect(screen.getByRole('button', { name: 'Revalidate recorded completion' })).toBeTruthy()
  expect(mocks.rpc.mock.calls.map((call) => call[1])).toEqual([
    'kontext.listTasks',
    'kontext.inspectFinalization'
  ])
  expect(window.localStorage.length).toBe(0)
})
it('searches only loaded rows and discards the visible history after a failed list reload', async () => {
  render(<KontextTaskInventory owner={owner} disabled={false} onSelect={() => {}} />)
  fireEvent.click(await load())
  fireEvent.change(screen.getByLabelText('Search loaded tasks…'), { target: { value: 'missing' } })
  expect(screen.queryByRole('button', { name: `Open task: ${row.intent}` })).toBeNull()
  expect(mocks.rpc).toHaveBeenCalledTimes(1)
  mocks.rpc.mockRejectedValueOnce(new Error('private details'))
  fireEvent.click(screen.getByRole('button', { name: 'Load task list' }))
  await screen.findByRole('alert')
  expect(screen.queryByRole('button', { name: 'Read completion record' })).toBeNull()
  expect(screen.queryByText('private details')).toBeNull()
})
it('refuses selecting a row after the owner pairing changed', async () => {
  const select = vi.fn()
  render(<KontextTaskInventory owner={owner} disabled={false} onSelect={select} />)
  const open = await load()
  mocks.revision = 2
  fireEvent.click(open)
  expect(select).not.toHaveBeenCalled()
})
it('refuses a replaced completion record instead of showing it under old metadata', async () => {
  render(<KontextTaskInventory owner={owner} disabled={false} onSelect={() => {}} />)
  fireEvent.click(await load())
  mocks.rpc.mockResolvedValueOnce({
    taskId: row.taskId,
    record: { ...record, recordId: `sha256:${'c'.repeat(64)}` },
    currentEvidence: 'not_revalidated'
  })
  fireEvent.click(screen.getByRole('button', { name: 'Read completion record' }))
  await screen.findByRole('alert')
  expect(screen.queryByRole('button', { name: 'Revalidate recorded completion' })).toBeNull()
})
