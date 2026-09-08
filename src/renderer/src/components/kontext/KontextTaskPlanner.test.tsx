// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n/i18n'
import { planFixture, planApprovalFixture } from '../../../../shared/__fixtures__/kontext-plan'
import { sourceInventoryFixture } from '../../../../shared/__fixtures__/kontext-source-inventory'
import { readKontextPlans, saveKontextPlan } from './kontext-plan-journal'
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), revision: 1 }))
vi.mock('@/runtime/runtime-rpc-client', () => ({ callRuntimeRpc: mocks.rpc }))
vi.mock('@/runtime/runtime-environment-revision', () => ({
  getRuntimeEnvironmentRevision: () => mocks.revision
}))
import { KontextTaskPlanner } from './KontextTaskPlanner'
const owner = { kind: 'environment' as const, environmentId: 'peer:one', pairingRevision: 1 }
const button = (name: string) => screen.getByRole('button', { name })
beforeEach(async () => {
  window.localStorage.clear()
  mocks.revision = 1
  mocks.rpc.mockReset()
  await i18n.changeLanguage('en')
  mocks.rpc.mockImplementation(async (_owner, method, request) => {
    if (method === 'kontext.listSources') {
      return {
        ...sourceInventoryFixture,
        sources: [
          ...sourceInventoryFixture.sources,
          {
            ...sourceInventoryFixture.sources[0],
            resourceId: 'resource:blocked',
            title: 'unshared.md',
            sharing: null
          }
        ]
      }
    }
    if (method === 'kontext.startPlan') {
      return {
        created: true,
        plan: { ...planFixture, request: { ...planFixture.request, requestId: request.requestId } }
      }
    }
    if (method === 'kontext.approvePlan') {
      return { ...planApprovalFixture, requestId: request.requestId }
    }
    return { ...planFixture, request: { ...planFixture.request, requestId: request.requestId } }
  })
})
it('selects registered sources without granting permission and clears generation consent when selection changes', async () => {
  render(<KontextTaskPlanner owner={owner} onCreated={vi.fn()} />)
  fill()
  fireEvent.change(screen.getByLabelText(/Required source Resource IDs/), { target: { value: '' } })
  fireEvent.click(screen.getByRole('checkbox', { name: /Use my selected subscription/ }))
  expect(button('Generate plan').hasAttribute('disabled')).toBe(false)
  fireEvent.click(screen.getByRole('combobox', { name: 'Browse registered sources' }))
  const option = await screen.findByRole('option', { name: /notes\.md/ })
  expect(screen.getByRole('option', { name: /unshared\.md/ }).getAttribute('aria-disabled')).toBe(
    'true'
  )
  fireEvent.click(option)
  expect((screen.getByLabelText(/Required source Resource IDs/) as HTMLTextAreaElement).value).toBe(
    'resource:notes'
  )
  expect(button('Generate plan').hasAttribute('disabled')).toBe(true)
  fireEvent.click(option)
  expect((screen.getByLabelText(/Required source Resource IDs/) as HTMLTextAreaElement).value).toBe(
    ''
  )
  expect(mocks.rpc.mock.calls.map((call) => call[1])).toEqual(['kontext.listSources'])
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  window.localStorage.clear()
})
function fill() {
  fireEvent.change(screen.getByLabelText('What should change?'), {
    target: { value: 'Make total accurate' }
  })
  fireEvent.change(screen.getByLabelText('Coding workspace path or selector'), {
    target: { value: 'host-selector' }
  })
  fireEvent.change(screen.getByLabelText(/Required source Resource IDs/), {
    target: { value: 'resource:notes' }
  })
}
async function start() {
  fill()
  fireEvent.click(screen.getByRole('checkbox', { name: /Use my selected subscription/ }))
  fireEvent.click(button('Generate plan'))
  await screen.findByText('Awaiting your review')
}
it('requires distinct generation and approval consent and transfers the approved Task without scheduling', async () => {
  const created = vi.fn()
  render(<KontextTaskPlanner owner={owner} onCreated={created} />)
  expect(mocks.rpc).not.toHaveBeenCalled()
  fill()
  expect(button('Generate plan').hasAttribute('disabled')).toBe(true)
  await start()
  expect(readKontextPlans(window.localStorage, owner)).toHaveLength(1)
  expect(mocks.rpc).toHaveBeenCalledTimes(1)
  expect(screen.getByText('Do not rename total')).toBeTruthy()
  expect(screen.getByText('Compute total')).toBeTruthy()
  expect(screen.getByText(/workspace:typecheck/)).toBeTruthy()
  expect(button('Approve and register Task').hasAttribute('disabled')).toBe(true)
  expect(created).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('checkbox', { name: /I approve this exact/ }))
  fireEvent.click(button('Approve and register Task'))
  await screen.findByText('Task registered; implementation has not started')
  expect(created).toHaveBeenCalledExactlyOnceWith('host-task:fixture', 'host-selector')
  const requestId = readKontextPlans(window.localStorage, owner)[0].requestId
  expect(mocks.rpc).toHaveBeenLastCalledWith(
    owner,
    'kontext.approvePlan',
    { requestId, expectedPlanDigest: planFixture.planDigest },
    { expectedEnvironmentPairingRevision: 1, timeoutMs: 60_000 }
  )
  expect(mocks.rpc.mock.calls.some((call) => String(call[1]).includes('Schedule'))).toBe(false)
})
it('keeps unknown requests through reload and only inspects their saved identity', async () => {
  mocks.rpc.mockRejectedValueOnce(new Error('transport disconnected with private details'))
  const mounted = render(<KontextTaskPlanner owner={owner} onCreated={vi.fn()} />)
  fill()
  fireEvent.click(screen.getByRole('checkbox', { name: /Use my selected subscription/ }))
  fireEvent.click(button('Generate plan'))
  await screen.findByRole('alert')
  const saved = readKontextPlans(window.localStorage, owner)[0]
  expect(saved).toBeDefined()
  expect(screen.queryByText(/private details/)).toBeNull()
  mounted.unmount()
  render(<KontextTaskPlanner owner={owner} onCreated={vi.fn()} />)
  expect(mocks.rpc).toHaveBeenCalledTimes(1)
  fireEvent.click(button('Read plan status'))
  await screen.findByText('Awaiting your review')
  expect(mocks.rpc).toHaveBeenLastCalledWith(
    owner,
    'kontext.inspectPlan',
    { requestId: saved.requestId },
    expect.any(Object)
  )
  expect(mocks.rpc.mock.calls.filter((call) => call[1] === 'kontext.startPlan')).toHaveLength(1)
})
it('clears approval on refresh and rejects owner changes before publication', async () => {
  const created = vi.fn()
  render(<KontextTaskPlanner owner={owner} onCreated={created} />)
  await start()
  fireEvent.click(screen.getByRole('checkbox', { name: /I approve this exact/ }))
  fireEvent.click(button('Read plan status'))
  await waitFor(() => expect(button('Read plan status').hasAttribute('disabled')).toBe(false))
  expect(button('Approve and register Task').hasAttribute('disabled')).toBe(true)
  fireEvent.click(screen.getByRole('checkbox', { name: /I approve this exact/ }))
  mocks.revision = 2
  fireEvent.click(button('Approve and register Task'))
  await screen.findByText('Runtime pairing changed. Reload before continuing.')
  expect(created).not.toHaveBeenCalled()
  expect(mocks.rpc.mock.calls.filter((call) => call[1] === 'kontext.approvePlan')).toHaveLength(0)
})
it('does not start when recovery storage fails and preserves existing requests', async () => {
  render(<KontextTaskPlanner owner={owner} onCreated={vi.fn()} />)
  const write = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
    throw new Error('quota')
  })
  fill()
  fireEvent.click(screen.getByRole('checkbox', { name: /Use my selected subscription/ }))
  fireEvent.click(button('Generate plan'))
  await screen.findByRole('alert')
  expect(mocks.rpc).not.toHaveBeenCalled()
  write.mockRestore()
})
it('recovers an unconfirmed start with exactly the saved input after explicit consent', async () => {
  mocks.rpc.mockRejectedValueOnce(new Error('response lost'))
  render(<KontextTaskPlanner owner={owner} onCreated={vi.fn()} />)
  fill()
  fireEvent.click(screen.getByRole('checkbox', { name: /Use my selected subscription/ }))
  fireEvent.click(button('Generate plan'))
  await screen.findByRole('alert')
  const original = mocks.rpc.mock.calls[0][2]
  expect(button('Recover original planning request').hasAttribute('disabled')).toBe(true)
  fireEvent.click(screen.getByRole('checkbox', { name: /Use my selected subscription/ }))
  fireEvent.click(button('Recover original planning request'))
  await screen.findByText('Awaiting your review')
  expect(mocks.rpc.mock.calls[1][2]).toEqual(original)
  expect(readKontextPlans(window.localStorage, owner)).toHaveLength(1)
})
it('renders persisted plans only for the current owner and translates the form live', async () => {
  saveKontextPlan(window.localStorage, {
    owner: { kind: 'local' },
    requestId: planFixture.request.requestId,
    workspace: '/other',
    createdAt: planFixture.requestedAt
  })
  render(<KontextTaskPlanner owner={owner} onCreated={vi.fn()} />)
  expect(screen.queryByText('/other')).toBeNull()
  await act(() => i18n.changeLanguage('ko'))
  expect(screen.getByRole('heading', { name: '새 작업 계획' })).toBeTruthy()
  expect(screen.getByLabelText('무엇을 바꿀까요?')).toBeTruthy()
  expect(mocks.rpc).not.toHaveBeenCalled()
})
