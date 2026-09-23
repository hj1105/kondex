// @vitest-environment happy-dom
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { planFixture } from '../../../../shared/__fixtures__/kontext-plan'
import { RuntimeRpcCallError } from '@/runtime/runtime-rpc-result'
import { sourceInventoryFixture } from '../../../../shared/__fixtures__/kontext-source-inventory'
import {
  KONTEXT_PLAN_INVALID_PROPOSAL_DIAGNOSTIC,
  KONTEXT_PLAN_STATE_INVALID_DIAGNOSTIC,
  KONTEXT_PLAN_USAGE_LIMIT_DIAGNOSTIC,
  kontextPlanDiagnosticKey
} from './kontext-plan-failure'
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('@/runtime/runtime-rpc-client', () => ({ callRuntimeRpc: mocks.rpc }))
import { KontextTaskPlanner } from './KontextTaskPlanner'

const owner = { kind: 'local' as const }
const initialState = useAppStore.getInitialState()
const rpcFailure = (code: string, message = code) =>
  new RuntimeRpcCallError({
    id: 'desktop-ipc',
    ok: false,
    error: { code, message },
    _meta: { runtimeId: null }
  })

beforeEach(async () => {
  window.localStorage.clear()
  mocks.rpc.mockReset()
  await i18n.changeLanguage('en')
})
afterEach(() => {
  cleanup()
  useAppStore.setState(initialState, true)
})

function generate(workspace: string) {
  fireEvent.change(screen.getByLabelText('What should change?'), {
    target: { value: 'Make total accurate' }
  })
  fireEvent.change(screen.getByLabelText('Coding workspace path or selector'), {
    target: { value: workspace }
  })
  fireEvent.click(screen.getByRole('checkbox', { name: /Use my selected subscription/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Generate plan' }))
}

it.each([
  [rpcFailure('selector_not_found'), /No workspace matches this path or selector/],
  [rpcFailure('selector_ambiguous'), /More than one workspace matches/],
  [
    rpcFailure('runtime_error', "ENOENT: no such file or directory, realpath '/gone'"),
    /workspace folder is missing from its registered path/
  ],
  [
    rpcFailure(
      'runtime_error',
      'Kontext source registration requires a sidecar on the file host; local fallback is not allowed.'
    ),
    /lives on another host/
  ]
])('names a workspace the host rejected before planning', async (failure, reason) => {
  mocks.rpc.mockRejectedValueOnce(failure)
  render(<KontextTaskPlanner owner={owner} onCreated={vi.fn()} />)
  generate('/nowhere')
  expect((await screen.findByRole('alert')).textContent).toMatch(reason)
})

it('keeps unknown failures generic and never shows host text', async () => {
  mocks.rpc.mockRejectedValueOnce(rpcFailure('runtime_error', 'PRIVATE host detail'))
  render(<KontextTaskPlanner owner={owner} onCreated={vi.fn()} />)
  generate('/nowhere')
  expect((await screen.findByRole('alert')).textContent).toMatch(/The operation was not confirmed/)
  expect(screen.queryByText(/PRIVATE/)).toBeNull()
})

// Why: a folder workspace resolves only by `folder:<id>`; its path returned selector_not_found.
it('sends the folder selector when the typed path is a folder workspace', async () => {
  useAppStore.setState({
    folderWorkspaces: [
      {
        id: 'f1',
        name: 'kondex',
        folderPath: '/Users/me/kondex',
        isArchived: false
      }
    ] as never
  })
  mocks.rpc.mockRejectedValueOnce(rpcFailure('selector_not_found'))
  render(<KontextTaskPlanner owner={owner} onCreated={vi.fn()} />)
  generate('/Users/me/kondex/')
  await screen.findByRole('alert')
  expect(mocks.rpc.mock.calls[0][2]).toMatchObject({ workspace: 'folder:f1' })
})

function planFails(diagnostic: string) {
  mocks.rpc.mockImplementation(async (_owner, _method, request) => ({
    created: true,
    plan: {
      ...planFixture,
      status: 'failed',
      proposal: undefined,
      planDigest: undefined,
      diagnostic,
      request: { ...planFixture.request, requestId: request.requestId }
    }
  }))
  render(<KontextTaskPlanner owner={owner} onCreated={vi.fn()} />)
  generate('/nowhere')
}

it('explains an exhausted subscription reported by the planner', async () => {
  planFails(
    `${KONTEXT_PLAN_USAGE_LIMIT_DIAGNOSTIC}; nothing was planned. Wait for the subscription limit to reset or choose another runtime.`
  )
  expect(await screen.findByText(/subscription usage limit is reached/)).toBeTruthy()
})

it('explains an invalid proposal and keeps the sidecar reason untranslated', async () => {
  planFails(
    `${KONTEXT_PLAN_INVALID_PROPOSAL_DIAGNOSTIC} (contract.risk: invalid_enum_value, root: custom: Plan requires exact workspace-relative paths); no Task was approved.`
  )
  await screen.findByText(/does not match the plan format/)
  await act(() => i18n.changeLanguage('ko'))
  const text = (await screen.findByText(/형식에 맞지 않는 제안/)).textContent
  expect(text).toMatch(
    /\(contract\.risk: invalid_enum_value, root: custom: Plan requires exact workspace-relative paths\)$/
  )
  expect(text).not.toContain('no Task was approved')
})

it('explains an invalid proposal that carries no reason', async () => {
  planFails(`${KONTEXT_PLAN_INVALID_PROPOSAL_DIAGNOSTIC}; no Task was approved.`)
  const text = (await screen.findByText(/does not match the plan format/)).textContent
  expect(text).toMatch(/Generate the plan again\.$/)
})

it('does not blame the planner when saved planning state fails validation', async () => {
  const diagnostic = `${KONTEXT_PLAN_STATE_INVALID_DIAGNOSTIC}; no Task was approved.`
  expect(kontextPlanDiagnosticKey(diagnostic)).toBe('stateInvalid')
  planFails(diagnostic)
  await screen.findByText(/Saved planning state could not be validated/)
  expect(screen.queryByText(/does not match the plan format/)).toBeNull()
})

it('says an empty source list is optional without repeating the no-match text', async () => {
  mocks.rpc.mockResolvedValue({
    ...sourceInventoryFixture,
    sources: [],
    nextCursor: null
  })
  render(<KontextTaskPlanner owner={owner} onCreated={vi.fn()} />)
  fireEvent.click(screen.getByRole('combobox', { name: 'Browse registered sources' }))
  expect(await screen.findByText(/Ontology sources are not included/)).toBeTruthy()
  expect(screen.queryByText(/No matching sources loaded/)).toBeNull()
})

// Why: CI checks out without submodules; locally this pins the wording the renderer translates.
const sidecarPlanning = join(
  process.cwd(),
  'vendor/kontext-brain/packages/tool-server/src/local-task-planning.ts'
)
it.skipIf(!existsSync(sidecarPlanning))('matches the sidecar usage-limit diagnostic', () => {
  expect(readFileSync(sidecarPlanning, 'utf8')).toContain(
    `PLANNING_USAGE_LIMIT_DIAGNOSTIC = "${KONTEXT_PLAN_USAGE_LIMIT_DIAGNOSTIC}"`
  )
})

it.skipIf(!existsSync(sidecarPlanning))('matches the sidecar invalid-proposal diagnostic', () => {
  const source = readFileSync(sidecarPlanning, 'utf8')
  expect(source).toContain(
    `PLANNING_INVALID_PROPOSAL_DIAGNOSTIC = "${KONTEXT_PLAN_INVALID_PROPOSAL_DIAGNOSTIC}"`
  )
  // The renderer strips exactly this suffix to show the reason.
  expect(source).toContain('); no Task was approved.`')
})

it.skipIf(!existsSync(sidecarPlanning))('matches the sidecar state-invalid diagnostic', () => {
  expect(readFileSync(sidecarPlanning, 'utf8')).toContain(
    `PLANNING_STATE_INVALID_DIAGNOSTIC = "${KONTEXT_PLAN_STATE_INVALID_DIAGNOSTIC}"`
  )
})
