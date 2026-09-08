// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n/i18n'
import { completionFixture } from '../../../../shared/__fixtures__/kontext-completion'
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), revision: 1 }))
vi.mock('@/runtime/runtime-rpc-client', () => ({ callRuntimeRpc: mocks.rpc }))
vi.mock('@/runtime/runtime-environment-revision', () => ({
  getRuntimeEnvironmentRevision: () => mocks.revision
}))
import { KontextCompletionAssessment } from './KontextCompletionAssessment'
const props = {
  owner: { kind: 'local' as const },
  taskId: completionFixture.taskId,
  jobId: completionFixture.jobId,
  disabled: false
}
beforeEach(async () => {
  mocks.rpc.mockReset().mockResolvedValue(completionFixture)
  mocks.revision = 1
  await i18n.changeLanguage('en')
})
afterEach(cleanup)
it('requests only on explicit action and shows the host verdict with its time and manifest', async () => {
  const view = render(<KontextCompletionAssessment {...props} />)
  expect(mocks.rpc).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Assess completion' }))
  await screen.findByText('Completion requirements met at observation')
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith(
    props.owner,
    'kontext.assessCompletion',
    {
      taskId: props.taskId,
      jobId: props.jobId
    },
    expect.objectContaining({ timeoutMs: 60_000 })
  )
  expect(screen.getByText(completionFixture.gitCommit)).toBeTruthy()
  expect(screen.getByText(/accuracy-manifest:one/)).toBeTruthy()
  view.unmount()
  render(<KontextCompletionAssessment {...props} />)
  expect(mocks.rpc).toHaveBeenCalledTimes(1)
  expect(screen.queryByText('Completion requirements met at observation')).toBeNull()
})
it('clears a previous successful assessment when a new request cannot be confirmed', async () => {
  render(<KontextCompletionAssessment {...props} />)
  fireEvent.click(screen.getByRole('button', { name: 'Assess completion' }))
  await screen.findByText('Completion requirements met at observation')
  mocks.rpc.mockRejectedValue(new Error('network down'))
  fireEvent.click(screen.getByRole('button', { name: 'Assess completion' }))
  await screen.findByRole('alert')
  expect(screen.queryByText('Completion requirements met at observation')).toBeNull()
  expect(mocks.rpc).toHaveBeenCalledTimes(2)
})
it('shows missing approval as pending and never manufactures a done verdict', async () => {
  mocks.rpc.mockResolvedValue({
    ...completionFixture,
    state: 'awaiting_evidence',
    issues: [{ code: 'missing_code_owner_approval', message: 'Code Owner approval is required' }]
  })
  render(<KontextCompletionAssessment {...props} />)
  fireEvent.click(screen.getByRole('button', { name: 'Assess completion' }))
  await screen.findByText('Awaiting completion evidence or owner approval')
  expect(screen.getByText('Code Owner approval is required')).toBeTruthy()
  expect(screen.queryByText('Completion requirements met at observation')).toBeNull()
})
it('refuses a late answer after pairing changes and does not double dispatch', async () => {
  let resolve: ((value: unknown) => void) | undefined
  mocks.rpc.mockReturnValue(
    new Promise((done) => {
      resolve = done
    })
  )
  render(
    <KontextCompletionAssessment
      {...props}
      owner={{ kind: 'environment', environmentId: 'remote', pairingRevision: 1 }}
    />
  )
  fireEvent.click(screen.getByRole('button', { name: 'Assess completion' }))
  fireEvent.click(screen.getByRole('button', { name: 'Assess completion' }))
  expect(mocks.rpc).toHaveBeenCalledTimes(1)
  mocks.revision = 2
  await act(async () => {
    resolve?.(completionFixture)
  })
  await screen.findByRole('alert')
  expect(screen.queryByText('Completion requirements met at observation')).toBeNull()
})
it('rejects a contradictory or differently scoped result and localizes the assessment controls', async () => {
  await i18n.changeLanguage('ko')
  mocks.rpc.mockResolvedValue({ ...completionFixture, jobId: 'different' })
  render(<KontextCompletionAssessment {...props} />)
  fireEvent.click(screen.getByRole('button', { name: '완료 조건 확인' }))
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain('완료를 확인하지 못했습니다')
  )
})
