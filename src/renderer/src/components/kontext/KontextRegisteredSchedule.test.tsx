// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n/i18n'
import { registeredScheduleFixture as inspection } from '../../../../shared/__fixtures__/kontext-registered-schedule'
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), revision: 1 }))
vi.mock('@/runtime/runtime-rpc-client', () => ({ callRuntimeRpc: mocks.rpc }))
vi.mock('@/runtime/runtime-environment-revision', () => ({
  getRuntimeEnvironmentRevision: () => mocks.revision
}))
import { KontextRegisteredSchedule } from './KontextRegisteredSchedule'
const owner = { kind: 'environment' as const, environmentId: 'host:one', pairingRevision: 1 }
const selector = { taskId: inspection.job.taskId, jobId: inspection.job.jobId }
beforeEach(async () => {
  mocks.revision = 1
  mocks.rpc.mockReset().mockResolvedValue(inspection)
  window.localStorage.clear()
  await i18n.changeLanguage('en')
})
afterEach(cleanup)
async function load() {
  render(<KontextRegisteredSchedule owner={owner} {...selector} disabled={false} />)
  expect(mocks.rpc).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Read saved execution' }))
  await screen.findByText('work:one')
}
it('reads without resuming and requires new explicit subscription consent for every resume', async () => {
  await load()
  const resume = screen.getByRole('button', { name: 'Revalidate / resume this execution' })
  expect(resume.hasAttribute('disabled')).toBe(true)
  fireEvent.click(screen.getByRole('checkbox'))
  mocks.rpc.mockResolvedValueOnce({
    ...inspection,
    command: { action: 'resume', resumeBlocked: true }
  })
  fireEvent.click(resume)
  fireEvent.click(resume)
  await screen.findByText(/Resume blocked by existing validation/)
  expect(mocks.rpc.mock.calls.map((call) => call[1])).toEqual([
    'kontext.inspectRegisteredSchedule',
    'kontext.resumeRegisteredSchedule'
  ])
  expect(mocks.rpc.mock.calls[1][2]).toEqual({
    ...selector,
    expectedJobIdentityDigest: inspection.jobIdentityDigest,
    allowSubscriptionExecution: true
  })
  expect(screen.getByRole('checkbox').getAttribute('aria-checked')).toBe('false')
  expect(
    screen
      .getByRole('button', { name: 'Revalidate / resume this execution' })
      .hasAttribute('disabled')
  ).toBe(true)
  expect(window.localStorage.length).toBe(0)
})
it('shows durable cancellation intent without claiming an interrupted worker stopped', async () => {
  await load()
  mocks.rpc.mockResolvedValueOnce({
    ...inspection,
    job: { ...inspection.job, cancellationRequestedAt: '2026-09-07T00:00:00.000Z' },
    command: { action: 'cancel' }
  })
  fireEvent.click(screen.getByRole('button', { name: 'Request execution cancellation' }))
  await screen.findByText('2026-09-07T00:00:00.000Z')
  expect(screen.getByText('Interrupted')).toBeTruthy()
  expect(screen.queryByText('Cancelled')).toBeNull()
  expect(
    screen
      .getByRole('button', { name: 'Revalidate / resume this execution' })
      .hasAttribute('disabled')
  ).toBe(true)
  expect(mocks.rpc.mock.calls[1][2]).toEqual({
    ...selector,
    expectedJobIdentityDigest: inspection.jobIdentityDigest
  })
})
it('clears controls after an unknown command result and requires a separate inspection', async () => {
  await load()
  mocks.rpc.mockRejectedValueOnce(new Error('PRIVATE_DETAILS'))
  fireEvent.click(screen.getByRole('button', { name: 'Request execution cancellation' }))
  await screen.findByRole('alert')
  expect(screen.queryByRole('button', { name: 'Request execution cancellation' })).toBeNull()
  expect(screen.queryByText('PRIVATE_DETAILS')).toBeNull()
  expect(mocks.rpc).toHaveBeenCalledTimes(2)
  fireEvent.click(screen.getByRole('button', { name: 'Read saved execution' }))
  await screen.findByText('work:one')
  expect(mocks.rpc.mock.calls[2][1]).toBe('kontext.inspectRegisteredSchedule')
})
it('refuses a late reply after pairing changes and never replaces it with local data', async () => {
  let finish: (value: unknown) => void = () => {
    throw new Error('Missing fixture promise')
  }
  mocks.rpc.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve
    })
  )
  render(<KontextRegisteredSchedule owner={owner} {...selector} disabled={false} />)
  fireEvent.click(screen.getByRole('button', { name: 'Read saved execution' }))
  mocks.revision = 2
  await act(async () => finish(inspection))
  await screen.findByRole('alert')
  expect(screen.queryByText('work:one')).toBeNull()
  expect(mocks.rpc).toHaveBeenCalledTimes(1)
})
