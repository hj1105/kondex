// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest'
import { planFixture } from '../../../../shared/__fixtures__/kontext-plan'
import { readKontextPlans, saveKontextPlan } from './kontext-plan-journal'

const owner = { kind: 'local' as const }
const saved = {
  owner,
  requestId: '8d2953eb-a75a-4b9f-a617-194e04b2901e',
  workspace: 'host-selector',
  createdAt: planFixture.requestedAt,
  refinementRequest: {
    requestId: '8d2953eb-a75a-4b9f-a617-194e04b2901e',
    parentRequestId: planFixture.request.requestId,
    expectedParentDigest: planFixture.planDigest,
    feedback: 'Preserve rounding'
  }
}
afterEach(() => window.localStorage.clear())
it('retains exact refinement recovery separately from ordinary requests', () => {
  saveKontextPlan(window.localStorage, saved)
  expect(readKontextPlans(window.localStorage, owner)).toEqual([saved])
  expect(() =>
    saveKontextPlan(window.localStorage, {
      ...saved,
      refinementRequest: { ...saved.refinementRequest, feedback: 'Changed' }
    })
  ).toThrow('Cannot replace')
})
it('refuses ambiguous, mismatched or self-parented recovery records', () => {
  const { workspacePath: _path, workspaceId: _id, ...request } = planFixture.request
  for (const invalid of [
    {
      ...saved,
      request: {
        ...request,
        provider: 'codex' as const,
        requestId: saved.requestId,
        workspace: saved.workspace
      }
    },
    { ...saved, refinementRequest: { ...saved.refinementRequest, requestId: crypto.randomUUID() } },
    {
      ...saved,
      refinementRequest: { ...saved.refinementRequest, parentRequestId: saved.requestId }
    }
  ]) {
    expect(() => saveKontextPlan(window.localStorage, invalid)).toThrow()
  }
  expect(readKontextPlans(window.localStorage, owner)).toEqual([])
})
