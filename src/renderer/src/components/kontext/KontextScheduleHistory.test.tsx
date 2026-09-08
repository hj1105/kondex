// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n/i18n'
import { scheduleHistoryFixture as history } from '../../../../shared/__fixtures__/kontext-schedule-history'
import { registeredScheduleFixture as inspection } from '../../../../shared/__fixtures__/kontext-registered-schedule'
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), revision: 1 }))
vi.mock('@/runtime/runtime-rpc-client', () => ({ callRuntimeRpc: mocks.rpc }))
vi.mock('@/runtime/runtime-environment-revision', () => ({
  getRuntimeEnvironmentRevision: () => mocks.revision
}))
import { KontextScheduleHistory } from './KontextScheduleHistory'
const owner = { kind: 'environment' as const, environmentId: 'host:one', pairingRevision: 1 }
const props = { owner, taskId: history.taskId, latestJobId: inspection.job.jobId, disabled: false }
beforeEach(async () => {
  mocks.revision = 1
  window.localStorage.clear()
  await i18n.changeLanguage('en')
  mocks.rpc.mockReset().mockImplementation(async (_owner, method, params) => {
    if (method === 'kontext.listRegisteredSchedules') {
      return history
    }
    if (method === 'kontext.inspectRegisteredSchedule') {
      return { ...inspection, job: { ...inspection.job, jobId: params.jobId } }
    }
    throw new Error('Unexpected fixture method')
  })
})
afterEach(() => {
  cleanup()
  window.localStorage.clear()
})
async function load() {
  fireEvent.click(screen.getByRole('button', { name: 'Load execution history' }))
  return screen.findByRole('button', { name: 'Select execution: job:older' })
}
it('selects an older host execution with no journal and discards prior inspection and consent', async () => {
  render(<KontextScheduleHistory {...props} />)
  expect(mocks.rpc).not.toHaveBeenCalled()
  fireEvent.click(await load())
  expect(mocks.rpc).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'Read saved execution' }))
  await screen.findByRole('checkbox')
  fireEvent.click(screen.getByRole('checkbox'))
  expect(
    (
      screen.getByRole('button', {
        name: 'Revalidate / resume this execution'
      }) as HTMLButtonElement
    ).disabled
  ).toBe(false)
  expect(mocks.rpc.mock.calls.at(-1)?.slice(1, 3)).toEqual([
    'kontext.inspectRegisteredSchedule',
    { taskId: history.taskId, jobId: 'job:older' }
  ])
  fireEvent.click(screen.getByRole('button', { name: `Select execution: ${inspection.job.jobId}` }))
  expect(screen.queryByRole('checkbox')).toBeNull()
  expect(mocks.rpc).toHaveBeenCalledTimes(2)
  expect(window.localStorage.length).toBe(0)
})
it('searches loaded metadata and clears selected controls on failed refresh without retrying', async () => {
  render(<KontextScheduleHistory {...props} />)
  fireEvent.click(await load())
  fireEvent.change(screen.getByLabelText('Search loaded executions…'), {
    target: { value: 'older' }
  })
  expect(
    screen.queryByRole('button', { name: `Select execution: ${inspection.job.jobId}` })
  ).toBeNull()
  mocks.rpc.mockRejectedValueOnce(new Error('PRIVATE'))
  fireEvent.click(screen.getByRole('button', { name: 'Load execution history' }))
  await screen.findByRole('alert')
  expect(screen.queryByRole('button', { name: 'Read saved execution' })).toBeNull()
  expect(screen.queryByText('PRIVATE')).toBeNull()
  expect(mocks.rpc).toHaveBeenCalledTimes(2)
})
it.each(['digest', 'duplicate', 'owner', 'offset', 'task'] as const)(
  'rejects a changed %s across pages and clears selection',
  async (change) => {
    const jobs = Array.from({ length: 50 }, (_, index) => ({
      ...history.schedules[0]!,
      jobId: `job:${index}`
    }))
    const cursor = { digest: history.inventoryDigest, offset: 50 }
    mocks.rpc.mockResolvedValueOnce({ ...history, schedules: jobs, nextCursor: cursor })
    render(<KontextScheduleHistory {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Load execution history' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Select execution: job:0' }))
    mocks.rpc.mockResolvedValueOnce({
      ...history,
      ...(change === 'digest' ? { inventoryDigest: `sha256:${'e'.repeat(64)}` } : {}),
      ...(change === 'duplicate' ? { schedules: [jobs[0]] } : {}),
      ...(change === 'owner' ? { organizationId: 'different' } : {}),
      ...(change === 'offset' ? { nextCursor: cursor } : {}),
      ...(change === 'task' ? { taskId: 'different' } : {})
    })
    fireEvent.click(screen.getByRole('button', { name: 'Load more executions' }))
    await screen.findByRole('alert')
    expect(screen.queryByRole('button', { name: 'Read saved execution' })).toBeNull()
    expect(mocks.rpc.mock.calls.at(-1)?.[2]).toEqual({ taskId: history.taskId, limit: 50, cursor })
  }
)
it('rejects late pairing replies and does not duplicate a pending request', async () => {
  let resolve!: (value: unknown) => void
  mocks.rpc.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done
    })
  )
  render(<KontextScheduleHistory {...props} />)
  const button = screen.getByRole('button', { name: 'Load execution history' })
  fireEvent.click(button)
  fireEvent.click(button)
  expect(mocks.rpc).toHaveBeenCalledTimes(1)
  mocks.revision = 2
  resolve(history)
  await screen.findByRole('alert')
  expect(screen.queryByRole('button', { name: 'Select execution: job:older' })).toBeNull()
})
it('discards a late old-Task response after switching Tasks', async () => {
  let resolve!: (value: unknown) => void
  mocks.rpc.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done
    })
  )
  const view = render(<KontextScheduleHistory {...props} />)
  fireEvent.click(screen.getByRole('button', { name: 'Load execution history' }))
  view.rerender(<KontextScheduleHistory {...props} taskId="task:another" latestJobId={undefined} />)
  resolve(history)
  await waitFor(() =>
    expect(
      (screen.getByRole('button', { name: 'Load execution history' }) as HTMLButtonElement).disabled
    ).toBe(false)
  )
  expect(screen.queryByRole('button', { name: 'Select execution: job:older' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Read saved execution' })).toBeNull()
})
