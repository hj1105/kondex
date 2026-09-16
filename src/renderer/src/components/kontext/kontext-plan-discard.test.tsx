// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n/i18n'
import { planFixture } from '../../../../shared/__fixtures__/kontext-plan'
import { deleteKontextPlan, readKontextPlans, saveKontextPlan } from './kontext-plan-journal'
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), revision: 1 }))
vi.mock('@/runtime/runtime-rpc-client', () => ({ callRuntimeRpc: mocks.rpc }))
vi.mock('@/runtime/runtime-environment-revision', () => ({
  getRuntimeEnvironmentRevision: () => mocks.revision
}))
import { KontextTaskPlanner } from './KontextTaskPlanner'

const owner = { kind: 'environment' as const, environmentId: 'peer:one', pairingRevision: 1 }
// the journal stores the request form (workspace), not the view form
// (workspacePath/workspaceId) the plan fixture carries
const workspace = 'workspace:/host/workspace'
const request = {
  requestId: planFixture.request.requestId,
  workspace,
  goal: planFixture.request.goal,
  provider: 'codex' as const,
  sourceResourceIds: planFixture.request.sourceResourceIds
}
const saved = {
  owner,
  requestId: request.requestId,
  workspace,
  createdAt: planFixture.requestedAt,
  request
}

beforeEach(async () => {
  window.localStorage.clear()
  mocks.rpc.mockReset()
  await i18n.changeLanguage('en')
})
afterEach(cleanup)

it('removes a saved planning request from storage', () => {
  saveKontextPlan(window.localStorage, saved)
  deleteKontextPlan(window.localStorage, saved.requestId)
  expect(readKontextPlans(window.localStorage, owner)).toEqual([])
})

it('leaves other saved requests alone', () => {
  const other = {
    owner,
    requestId: planFixture.request.requestId.replace(/.$/, '0'),
    workspace,
    createdAt: planFixture.requestedAt
  }
  saveKontextPlan(window.localStorage, saved)
  saveKontextPlan(window.localStorage, other)
  deleteKontextPlan(window.localStorage, saved.requestId)
  expect(readKontextPlans(window.localStorage, owner).map((e) => e.requestId)).toEqual([
    other.requestId
  ])
})

// Why: recovery replays the request on the runtime that owns it, so a request
// whose runtime is unavailable can only be cleared by discarding it. Without
// this control the planner stays pinned to that request and no new plan can be
// started.
it('discards the pinned request from the planner without calling the runtime', async () => {
  saveKontextPlan(window.localStorage, saved)
  render(<KontextTaskPlanner owner={owner} onCreated={() => {}} />)

  const discard = await screen.findByRole('button', { name: 'Discard this saved request' })
  fireEvent.click(discard)

  await waitFor(() => {
    expect(readKontextPlans(window.localStorage, owner)).toEqual([])
  })
  expect(screen.queryByRole('button', { name: 'Recover original planning request' })).toBeNull()
  expect(mocks.rpc).not.toHaveBeenCalled()
})
