// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n/i18n'
import { planApprovalFixture, planFixture } from '../../../../shared/__fixtures__/kontext-plan'
import { readKontextPlans, saveKontextPlan } from './kontext-plan-journal'
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), revision: 1 }))
vi.mock('@/runtime/runtime-rpc-client', () => ({ callRuntimeRpc: mocks.rpc }))
vi.mock('@/runtime/runtime-environment-revision', () => ({
  getRuntimeEnvironmentRevision: () => mocks.revision
}))
import { KontextTaskPlanner } from './KontextTaskPlanner'
const owner = { kind: 'environment' as const, environmentId: 'peer:one', pairingRevision: 1 }
const parent = {
  owner,
  requestId: planFixture.request.requestId,
  workspace: 'host-selector',
  createdAt: planFixture.requestedAt
}
const button = (name: string) => screen.getByRole('button', { name })
function reply(request: {
  requestId: string
  parentRequestId: string
  expectedParentDigest: string
  feedback: string
}) {
  const { requestId, ...refinement } = request
  return {
    created: true,
    plan: {
      ...planFixture,
      request: { ...planFixture.request, requestId },
      planDigest: `sha256:${'d'.repeat(64)}`,
      refinement
    }
  }
}
beforeEach(async () => {
  window.localStorage.clear()
  saveKontextPlan(window.localStorage, parent)
  mocks.revision = 1
  mocks.rpc.mockReset().mockImplementation(async (_owner, method, request) => {
    if (method === 'kontext.inspectPlan') {
      return planFixture
    }
    if (method === 'kontext.refinePlan') {
      return reply(request)
    }
    throw new Error(`Unexpected call ${method}`)
  })
  await i18n.changeLanguage('en')
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  window.localStorage.clear()
})
async function inspect() {
  fireEvent.click(button('Read plan status'))
  await screen.findByText('Awaiting your review')
}
function consent() {
  fireEvent.click(screen.getByRole('checkbox', { name: /Use the parent draft/ }))
}
function feedback(value = 'Preserve rounding') {
  fireEvent.change(screen.getByLabelText('What should this draft change?'), { target: { value } })
}
it('retains the parent, durably saves before dispatch, and requires fresh consent and child approval', async () => {
  const created = vi.fn()
  render(<KontextTaskPlanner owner={owner} onCreated={created} />)
  await inspect()
  fireEvent.click(screen.getByRole('checkbox', { name: /I approve this exact/ }))
  feedback()
  expect(button('Request a revised draft').hasAttribute('disabled')).toBe(true)
  consent()
  feedback('Preserve rounding and zero')
  expect(button('Request a revised draft').hasAttribute('disabled')).toBe(true)
  consent()
  mocks.rpc.mockImplementationOnce(async (_owner, method, request) => {
    expect(method).toBe('kontext.refinePlan')
    expect(readKontextPlans(window.localStorage, owner)[0].refinementRequest).toEqual(request)
    return reply(request)
  })
  fireEvent.click(button('Request a revised draft'))
  await screen.findByText('Parent draft and exact digest')
  const entries = readKontextPlans(window.localStorage, owner)
  expect(entries).toHaveLength(2)
  expect(entries[1]).toEqual(parent)
  expect(entries[0].refinementRequest).toMatchObject({
    parentRequestId: parent.requestId,
    expectedParentDigest: planFixture.planDigest,
    feedback: 'Preserve rounding and zero'
  })
  expect(entries[0].requestId).not.toBe(parent.requestId)
  await waitFor(() => expect(button('Read plan status').hasAttribute('disabled')).toBe(false))
  expect(button('Approve and register Task').hasAttribute('disabled')).toBe(true)
  expect(created).not.toHaveBeenCalled()
  expect(mocks.rpc.mock.calls.map((call) => call[1])).toEqual([
    'kontext.inspectPlan',
    'kontext.refinePlan'
  ])
  mocks.rpc.mockImplementationOnce(async (_owner, method, request) => {
    expect(method).toBe('kontext.approvePlan')
    expect(request).toEqual({
      requestId: entries[0].requestId,
      expectedPlanDigest: `sha256:${'d'.repeat(64)}`
    })
    return {
      ...planApprovalFixture,
      requestId: request.requestId,
      planDigest: request.expectedPlanDigest
    }
  })
  fireEvent.click(screen.getByRole('checkbox', { name: /I approve this exact/ }))
  fireEvent.click(button('Approve and register Task'))
  await screen.findByText('Task registered; implementation has not started')
  expect(created).toHaveBeenCalledExactlyOnceWith(planApprovalFixture.taskId, parent.workspace)
  expect(screen.queryByRole('button', { name: 'Request a revised draft' })).toBeNull()
  expect(readKontextPlans(window.localStorage, owner)[1]).toEqual(parent)
})
it('recovers lost replies across remount using the same refinement, never ordinary planning', async () => {
  const mounted = render(<KontextTaskPlanner owner={owner} onCreated={vi.fn()} />)
  await inspect()
  feedback()
  consent()
  mocks.rpc.mockRejectedValueOnce(new Error('reply lost'))
  fireEvent.click(button('Request a revised draft'))
  await screen.findByRole('alert')
  const original = mocks.rpc.mock.calls[1][2]
  mounted.unmount()
  render(<KontextTaskPlanner owner={owner} onCreated={vi.fn()} />)
  expect(mocks.rpc).toHaveBeenCalledTimes(2)
  expect(button('Recover original planning request').hasAttribute('disabled')).toBe(true)
  expect(screen.getByText('Preserve rounding')).toBeTruthy()
  consent()
  fireEvent.click(button('Recover original planning request'))
  await screen.findByText('Awaiting your review')
  expect(mocks.rpc).toHaveBeenLastCalledWith(owner, 'kontext.refinePlan', original, {
    expectedEnvironmentPairingRevision: 1,
    timeoutMs: 60_000
  })
  expect(readKontextPlans(window.localStorage, owner)).toHaveLength(2)
})
it.each(['storage', 'owner'])('does not dispatch when %s validation fails', async (failure) => {
  render(<KontextTaskPlanner owner={owner} onCreated={vi.fn()} />)
  await inspect()
  feedback()
  consent()
  const write =
    failure === 'storage'
      ? vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
          throw new Error('quota')
        })
      : null
  if (failure === 'owner') {
    mocks.revision = 2
  }
  try {
    fireEvent.click(button('Request a revised draft'))
    await screen.findByRole('alert')
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    expect(readKontextPlans(window.localStorage, owner)).toEqual([parent])
  } finally {
    write?.mockRestore()
  }
})
it('keeps an unconfirmed child recoverable when the host returns different feedback', async () => {
  render(<KontextTaskPlanner owner={owner} onCreated={vi.fn()} />)
  await inspect()
  feedback()
  consent()
  mocks.rpc.mockImplementationOnce(async (_owner, _method, request) =>
    reply({ ...request, feedback: 'Wrong' })
  )
  fireEvent.click(button('Request a revised draft'))
  await screen.findByRole('alert')
  expect(screen.queryByRole('button', { name: 'Approve and register Task' })).toBeNull()
  expect(readKontextPlans(window.localStorage, owner)).toHaveLength(2)
  expect(mocks.rpc).toHaveBeenCalledTimes(2)
})
