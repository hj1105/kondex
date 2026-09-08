// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n/i18n'
import { finalizationFixture } from '../../../../shared/__fixtures__/kontext-finalization'
import { readKontextFinalizations } from './kontext-finalization-journal'
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), revision: 1 }))
vi.mock('@/runtime/runtime-rpc-client', () => ({ callRuntimeRpc: mocks.rpc }))
vi.mock('@/runtime/runtime-environment-revision', () => ({
  getRuntimeEnvironmentRevision: () => mocks.revision
}))
import { KontextTaskFinalization } from './KontextTaskFinalization'
import { KontextFinalizationRevalidation } from './KontextFinalizationRevalidation'
const props = {
  owner: { kind: 'local' as const },
  taskId: finalizationFixture.request.taskId,
  jobId: finalizationFixture.request.jobId,
  basis: finalizationFixture.request.expectedCompletionBasisDigest,
  ready: true,
  disabled: false
}
const revalidation = {
  taskId: finalizationFixture.request.taskId,
  recordId: finalizationFixture.recordId,
  currentEvidence: 'revalidated_current',
  recordedCompletionBasisDigest: finalizationFixture.request.expectedCompletionBasisDigest,
  observedCompletionBasisDigest: finalizationFixture.request.expectedCompletionBasisDigest,
  observedAt: finalizationFixture.completedAt,
  state: 'done',
  issueCount: 0,
  contextStatus: 'current',
  codeRevision: finalizationFixture.codeRevision,
  contextDigest: finalizationFixture.contextDigest
}
beforeEach(async () => {
  window.localStorage.clear()
  mocks.rpc.mockReset()
  mocks.revision = 1
  await i18n.changeLanguage('en')
})
afterEach(() => {
  cleanup()
  window.localStorage.clear()
  vi.restoreAllMocks()
})
it('explicitly revalidates reviewed history, clears stale success and never retries or records', async () => {
  mocks.rpc.mockResolvedValue({
    taskId: props.taskId,
    record: finalizationFixture,
    currentEvidence: 'not_revalidated'
  })
  render(<KontextTaskFinalization {...props} />)
  expect(screen.queryByRole('button', { name: 'Revalidate recorded completion' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Read completion record' }))
  const button = await screen.findByRole('button', { name: 'Revalidate recorded completion' })
  expect(mocks.rpc).toHaveBeenCalledTimes(1)
  mocks.rpc.mockResolvedValue(revalidation)
  fireEvent.click(button)
  fireEvent.click(button)
  await screen.findByText(/Recorded completion valid at observation/)
  expect(mocks.rpc).toHaveBeenCalledTimes(2)
  expect(mocks.rpc).toHaveBeenLastCalledWith(
    props.owner,
    'kontext.revalidateFinalization',
    {
      taskId: props.taskId,
      expectedRecordId: finalizationFixture.recordId
    },
    expect.any(Object)
  )
  mocks.rpc.mockResolvedValue({
    ...revalidation,
    currentEvidence: 'changed',
    contextStatus: 'stale',
    state: 'blocked'
  })
  fireEvent.click(button)
  await screen.findByText(/no longer matches current evidence/)
  expect(screen.queryByText(/Recorded completion valid at observation/)).toBeNull()
  mocks.rpc.mockRejectedValue(new Error('unsupported host private detail'))
  fireEvent.click(button)
  await screen.findByText(/Current completion could not be confirmed/)
  expect(screen.queryByText(/no longer matches current evidence/)).toBeNull()
  expect(screen.queryByText(/private detail/)).toBeNull()
  expect(mocks.rpc).toHaveBeenCalledTimes(4)
  expect(readKontextFinalizations(window.localStorage, props.owner)).toEqual([])
})
it('discards revalidation after pairing replacement and refuses a mismatched basis', async () => {
  const pending = Promise.withResolvers<unknown>()
  mocks.rpc.mockReturnValue(pending.promise)
  const view = render(
    <KontextFinalizationRevalidation
      owner={{ kind: 'environment', environmentId: 'remote', pairingRevision: 1 }}
      record={finalizationFixture}
      disabled={false}
    />
  )
  expect(mocks.rpc).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Revalidate recorded completion' }))
  mocks.revision = 2
  await act(async () => pending.resolve(revalidation))
  await screen.findByRole('alert')
  expect(screen.queryByText(/valid at observation/)).toBeNull()
  view.unmount()
  mocks.rpc.mockResolvedValue({
    ...revalidation,
    currentEvidence: 'changed',
    recordedCompletionBasisDigest: `sha256:${'d'.repeat(64)}`
  })
  render(
    <KontextFinalizationRevalidation
      owner={props.owner}
      record={finalizationFixture}
      disabled={false}
    />
  )
  fireEvent.click(screen.getByRole('button', { name: 'Revalidate recorded completion' }))
  await screen.findByRole('alert')
  expect(screen.queryByText(/no longer matches/)).toBeNull()
})
it('saves a UUID before dispatch, recovers it after remount and never labels history as current', async () => {
  let accepted: typeof finalizationFixture | undefined
  mocks.rpc.mockImplementation(async (_owner, method, request) => {
    if (method === 'kontext.finalizeTask') {
      expect(readKontextFinalizations(window.localStorage, props.owner)[0]?.request).toEqual(
        request
      )
      accepted = { ...finalizationFixture, request }
      throw new Error('response lost after recording')
    }
    return { taskId: props.taskId, record: accepted, currentEvidence: 'not_revalidated' }
  })
  const first = render(<KontextTaskFinalization {...props} />)
  expect(mocks.rpc).not.toHaveBeenCalled()
  expect(
    screen.getByRole('button', { name: 'Record Task completion' }).hasAttribute('disabled')
  ).toBe(true)
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: 'Record Task completion' }))
  await screen.findByRole('alert')
  first.unmount()
  render(<KontextTaskFinalization {...props} />)
  expect(mocks.rpc).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'Read completion record' }))
  await screen.findByText(/Completion recorded at:/)
  expect(screen.getByText(/Historical record/)).toBeTruthy()
  expect(mocks.rpc).toHaveBeenLastCalledWith(
    props.owner,
    'kontext.inspectFinalization',
    {
      taskId: props.taskId,
      requestId: accepted?.request.requestId
    },
    expect.any(Object)
  )
  mocks.rpc.mockResolvedValue({
    created: false,
    record: accepted,
    currentEvidence: 'not_revalidated'
  })
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: 'Recover saved finalization' }))
  await screen.findByText(/Completion recorded at:/)
  expect(mocks.rpc).toHaveBeenLastCalledWith(
    props.owner,
    'kontext.finalizeTask',
    accepted?.request,
    expect.any(Object)
  )
})
it('keeps finalization disabled for unmet requirements, missing new-host support or unavailable storage', async () => {
  const view = render(<KontextTaskFinalization {...props} ready={false} />)
  expect(
    screen.getByRole('button', { name: 'Record Task completion' }).hasAttribute('disabled')
  ).toBe(true)
  view.unmount()
  window.localStorage.setItem('kondex.kontext.finalization.v1.broken', '{}')
  render(<KontextTaskFinalization {...props} />)
  expect(screen.getByText(/Recovery storage is unavailable/)).toBeTruthy()
  expect(
    screen.getByRole('button', { name: 'Record Task completion' }).hasAttribute('disabled')
  ).toBe(true)
  expect(mocks.rpc).not.toHaveBeenCalled()
})
it('discards a late result after pairing changes, preserving the saved request for recovery', async () => {
  let resolve: ((value: unknown) => void) | undefined
  mocks.rpc.mockReturnValue(
    new Promise((done) => {
      resolve = done
    })
  )
  const owner = { kind: 'environment' as const, environmentId: 'peer', pairingRevision: 1 }
  render(<KontextTaskFinalization {...props} owner={owner} />)
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: 'Record Task completion' }))
  const request = readKontextFinalizations(window.localStorage, owner)[0]?.request
  mocks.revision = 2
  await act(async () => {
    resolve?.({
      created: true,
      record: { ...finalizationFixture, request },
      currentEvidence: 'validated_at_recording'
    })
  })
  await screen.findByRole('alert')
  expect(screen.queryByText(/Completion recorded at:/)).toBeNull()
  expect(readKontextFinalizations(window.localStorage, owner)).toHaveLength(1)
})
