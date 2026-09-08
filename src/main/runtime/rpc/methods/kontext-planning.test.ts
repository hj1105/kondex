import { beforeEach, expect, it, vi } from 'vitest'
import { planFixture, planApprovalFixture } from '../../../../shared/__fixtures__/kontext-plan'
import type { OrcaRuntimeService } from '../../orca-runtime'
import { RpcDispatcher } from '../dispatcher'
import { kontextPlanningMethods } from './kontext-planning'
const mocks = vi.hoisted(() => ({ callTool: vi.fn(), resolve: vi.fn(), realpath: vi.fn() }))
vi.mock('../../../kontext/kontext-sidecar-runtime', () => ({
  getKontextSidecarService: () => ({ callTool: mocks.callTool })
}))
vi.mock('node:fs/promises', () => ({ realpath: mocks.realpath }))
const request = {
  requestId: planFixture.request.requestId,
  workspace: 'host-selector',
  goal: planFixture.request.goal,
  provider: 'codex',
  sourceResourceIds: ['resource:notes']
}
function call(method: string, params: unknown, signal?: AbortSignal, legacy = false) {
  return new RpcDispatcher({
    runtime: {
      getRuntimeId: () => 'host',
      resolveKontextSourceWorkspace: mocks.resolve
    } as unknown as OrcaRuntimeService,
    methods: legacy ? [] : kontextPlanningMethods
  }).dispatch({ id: 'test', authToken: 'fixture', method: `kontext.${method}`, params }, { signal })
}
beforeEach(() => {
  mocks.resolve.mockReset().mockResolvedValue('/alias/workspace')
  mocks.realpath.mockReset().mockResolvedValue('/host/workspace')
  mocks.callTool.mockReset().mockResolvedValue({ created: true, plan: planFixture })
})
it('resolves planning on the owning runtime and does not trust client paths or authority', async () => {
  expect(
    await call('startPlan', {
      ...request,
      workspacePath: '/client/wrong',
      workspaceId: 'forged',
      subjectId: 'forged',
      hostToken: 'forged'
    })
  ).toMatchObject({ ok: true, result: { plan: planFixture } })
  expect(mocks.resolve).toHaveBeenCalledExactlyOnceWith('host-selector')
  expect(mocks.callTool).toHaveBeenCalledExactlyOnceWith('kontext_start_plan', planFixture.request)
})
it('refuses mismatched plan identity and response fields without replaying', async () => {
  for (const change of [
    { requestId: crypto.randomUUID() },
    { goal: 'different' },
    { workspacePath: '/wrong' },
    { provider: 'claude' },
    { sourceResourceIds: [] }
  ]) {
    mocks.callTool.mockResolvedValue({
      created: true,
      plan: { ...planFixture, request: { ...planFixture.request, ...change } }
    })
    expect(await call('startPlan', request)).toMatchObject({ ok: false })
  }
  expect(mocks.callTool).toHaveBeenCalledTimes(5)
})
it('approval carries only an exact digest and checks Task and request confirmation', async () => {
  const approval = { requestId: request.requestId, expectedPlanDigest: planFixture.planDigest }
  mocks.callTool.mockResolvedValue({
    ...planApprovalFixture,
    hostToken: 'private',
    body: 'private'
  })
  const response = await call('approvePlan', {
    ...approval,
    proposal: { forged: true },
    subjectId: 'forged'
  })
  expect(response).toMatchObject({ ok: true, result: planApprovalFixture })
  expect(JSON.stringify(response)).not.toContain('private')
  expect(mocks.callTool).toHaveBeenCalledExactlyOnceWith('kontext_approve_plan', approval)
  for (const change of [
    { requestId: crypto.randomUUID() },
    { planDigest: `sha256:${'d'.repeat(64)}` },
    { taskId: 'other' }
  ]) {
    mocks.callTool.mockResolvedValue({ ...planApprovalFixture, ...change })
    expect(await call('approvePlan', approval)).toMatchObject({ ok: false })
  }
})
it('never falls back when a host is unsupported, cancelled, or unavailable', async () => {
  const controller = new AbortController()
  controller.abort()
  expect(await call('startPlan', request, controller.signal)).toMatchObject({ ok: false })
  expect(await call('startPlan', request, undefined, true)).toMatchObject({
    ok: false,
    error: { code: 'method_not_found' }
  })
  mocks.resolve.mockRejectedValue(new Error('remote host unavailable'))
  expect(await call('startPlan', request)).toMatchObject({ ok: false })
  expect(mocks.callTool).not.toHaveBeenCalled()
})
it.each(['inspect', 'cancel'])(
  '%s only targets the saved request and rejects a mismatched response',
  async (action) => {
    mocks.callTool.mockResolvedValue(planFixture)
    expect(
      await call(`${action}Plan`, { requestId: request.requestId, hostToken: 'forged' })
    ).toMatchObject({ ok: true })
    expect(mocks.callTool).toHaveBeenCalledExactlyOnceWith(`kontext_${action}_plan`, {
      requestId: request.requestId
    })
    mocks.callTool.mockResolvedValue({
      ...planFixture,
      request: { ...planFixture.request, requestId: crypto.randomUUID() }
    })
    expect(await call(`${action}Plan`, { requestId: request.requestId })).toMatchObject({
      ok: false
    })
  }
)

const refinement = {
  requestId: '8d2953eb-a75a-4b9f-a617-194e04b2901e',
  parentRequestId: request.requestId,
  expectedParentDigest: planFixture.planDigest,
  feedback: 'Preserve rounding at the boundary'
}
function refinedPlan() {
  const { requestId, ...lineage } = refinement
  return {
    ...planFixture,
    request: { ...planFixture.request, requestId },
    refinement: lineage
  }
}
it('refines only the exact host-owned parent without client workspace or authority overrides', async () => {
  mocks.callTool.mockResolvedValue({ created: true, plan: refinedPlan() })
  expect(
    await call('refinePlan', {
      ...refinement,
      workspace: '/forged',
      provider: 'claude',
      hostToken: 'forged'
    })
  ).toMatchObject({ ok: true, result: { plan: refinedPlan() } })
  expect(mocks.callTool).toHaveBeenCalledExactlyOnceWith('kontext_refine_plan', refinement)
  expect(mocks.resolve).not.toHaveBeenCalled()
})
it('refinement refuses unconfirmed lineage and never substitutes ordinary planning', async () => {
  for (const change of [
    { parentRequestId: crypto.randomUUID() },
    { expectedParentDigest: `sha256:${'e'.repeat(64)}` },
    { feedback: 'Different feedback' }
  ]) {
    mocks.callTool.mockResolvedValue({
      created: true,
      plan: {
        ...refinedPlan(),
        refinement: { ...refinedPlan().refinement, ...change }
      }
    })
    expect(await call('refinePlan', refinement)).toMatchObject({ ok: false })
  }
  mocks.callTool.mockResolvedValue({
    created: true,
    plan: {
      ...refinedPlan(),
      refinement: undefined
    }
  })
  expect(await call('refinePlan', refinement)).toMatchObject({ ok: false })
  mocks.callTool.mockRejectedValue(new Error('Unknown tool'))
  expect(await call('refinePlan', refinement)).toMatchObject({ ok: false })
  expect(await call('refinePlan', refinement, undefined, true)).toMatchObject({
    ok: false,
    error: { code: 'method_not_found' }
  })
  expect(mocks.callTool.mock.calls.every(([tool]) => tool === 'kontext_refine_plan')).toBe(true)
})
