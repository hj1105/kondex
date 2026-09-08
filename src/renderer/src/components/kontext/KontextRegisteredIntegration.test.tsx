// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n/i18n'
import {
  registeredIntegrationFixture as empty,
  savedIntegrationFixture as saved
} from '../../../../shared/__fixtures__/kontext-registered-integration'
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), revision: 1 }))
vi.mock('@/runtime/runtime-rpc-client', () => ({ callRuntimeRpc: mocks.rpc }))
vi.mock('@/runtime/runtime-environment-revision', () => ({
  getRuntimeEnvironmentRevision: () => mocks.revision
}))
import { KontextRegisteredIntegration } from './KontextRegisteredIntegration'
const owner = { kind: 'environment' as const, environmentId: 'host:one', pairingRevision: 1 }
const props = { owner, taskId: empty.taskId, jobId: empty.jobId, disabled: false }
beforeEach(async () => {
  mocks.revision = 1
  mocks.rpc.mockReset().mockResolvedValue(empty)
  window.localStorage.clear()
  await i18n.changeLanguage('en')
})
afterEach(() => {
  cleanup()
  window.localStorage.clear()
})
async function inspect() {
  fireEvent.click(screen.getByRole('button', { name: 'Read saved integration' }))
  return screen.findByRole('checkbox')
}
it('requires an explicit read and fresh consent, then exposes separate completion assessment', async () => {
  render(<KontextRegisteredIntegration {...props} />)
  expect(mocks.rpc).not.toHaveBeenCalled()
  const consent = await inspect()
  const button = screen.getByRole('button', {
    name: 'Integrate this reviewed execution'
  }) as HTMLButtonElement
  expect(button.disabled).toBe(true)
  fireEvent.click(consent)
  mocks.rpc.mockResolvedValueOnce({ ...saved, command: 'integrate' })
  fireEvent.click(button)
  fireEvent.click(button)
  await screen.findByText('commit:one')
  expect(screen.getByRole('button', { name: 'Assess completion' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Integrate this reviewed execution' })).toBeNull()
  expect(screen.queryByText('Completion requirements met at observation')).toBeNull()
  expect(mocks.rpc.mock.calls.map((call) => call[1])).toEqual([
    'kontext.inspectRegisteredIntegration',
    'kontext.integrateRegisteredSchedule'
  ])
  expect(mocks.rpc.mock.calls[1]?.[2]).toEqual({
    taskId: empty.taskId,
    jobId: empty.jobId,
    expectedJobIdentityDigest: empty.jobIdentityDigest,
    expectedIntegrationDigest: null,
    allowSubscriptionExecution: true
  })
  expect(window.localStorage.length).toBe(0)
})
it('clears an uncertain result and recovers saved integration without replaying or auto-assessing', async () => {
  render(<KontextRegisteredIntegration {...props} />)
  fireEvent.click(await inspect())
  mocks.rpc.mockRejectedValueOnce(new Error('PRIVATE lost response'))
  fireEvent.click(screen.getByRole('button', { name: 'Integrate this reviewed execution' }))
  await screen.findByRole('alert')
  expect(screen.queryByRole('checkbox')).toBeNull()
  expect(screen.queryByText('PRIVATE lost response')).toBeNull()
  mocks.rpc.mockResolvedValueOnce(saved)
  fireEvent.click(screen.getByRole('button', { name: 'Read saved integration' }))
  await screen.findByText('commit:one')
  expect(mocks.rpc.mock.calls.map((call) => call[1])).toEqual([
    'kontext.inspectRegisteredIntegration',
    'kontext.integrateRegisteredSchedule',
    'kontext.inspectRegisteredIntegration'
  ])
})
it('shows another execution’s integration and binds replacement to its reviewed digest', async () => {
  mocks.rpc.mockResolvedValueOnce({
    ...saved,
    integration: { ...saved.integration, scheduleJobId: 'job:other' }
  })
  render(<KontextRegisteredIntegration {...props} />)
  fireEvent.click(await inspect())
  expect(screen.getByText(/saved integration belongs to another execution/)).toBeTruthy()
  mocks.rpc.mockResolvedValueOnce({ ...saved, command: 'integrate' })
  fireEvent.click(screen.getByRole('button', { name: 'Integrate this reviewed execution' }))
  await screen.findByRole('button', { name: 'Assess completion' })
  expect(mocks.rpc.mock.calls[1]?.[2].expectedIntegrationDigest).toBe(saved.integrationDigest)
})
it('does not allow an unfinished schedule to integrate', async () => {
  mocks.rpc.mockResolvedValueOnce({
    ...empty,
    scheduleStatus: 'interrupted',
    canRequestIntegration: false
  })
  render(<KontextRegisteredIntegration {...props} />)
  await inspect()
  expect(
    (screen.getByRole('button', { name: 'Integrate this reviewed execution' }) as HTMLButtonElement)
      .disabled
  ).toBe(true)
})
it('refuses late pairing replies, clears stale data and prevents duplicate reads', async () => {
  let resolve!: (value: unknown) => void
  mocks.rpc.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done
    })
  )
  render(<KontextRegisteredIntegration {...props} />)
  const button = screen.getByRole('button', { name: 'Read saved integration' })
  fireEvent.click(button)
  fireEvent.click(button)
  expect(mocks.rpc).toHaveBeenCalledTimes(1)
  mocks.revision = 2
  resolve(saved)
  await screen.findByRole('alert')
  expect(screen.queryByText('commit:one')).toBeNull()
})
