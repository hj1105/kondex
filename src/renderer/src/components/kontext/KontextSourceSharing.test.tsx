// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n/i18n'
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), revision: 1 }))
vi.mock('@/runtime/runtime-rpc-client', () => ({ callRuntimeRpc: mocks.rpc }))
vi.mock('@/runtime/runtime-environment-revision', () => ({
  getRuntimeEnvironmentRevision: () => mocks.revision
}))
import { KontextSourceSharing } from './KontextSourceSharing'

const source = {
  organizationId: '8f424832-cd0f-4582-bfac-360e8704d302',
  resourceId: 'resource:one',
  title: 'notes.md',
  workspacePath: '/host/folder',
  relativePath: 'notes.md',
  contentHash: `sha256:${'a'.repeat(64)}`,
  revision: 1,
  status: 'active',
  sharing: null,
  normativeApproval: 'not_granted'
}
const owner = { kind: 'environment' as const, environmentId: 'peer:one', pairingRevision: 1 }
const button = (name: string) => screen.getByRole('button', { name })
const inspect = async () => {
  fireEvent.click(button('Read saved permissions'))
  await screen.findByText('Saved model permissions: None')
}
beforeEach(async () => {
  mocks.rpc.mockReset().mockResolvedValue(source)
  mocks.revision = 1
  await i18n.changeLanguage('en')
})
afterEach(cleanup)

it('requires an explicit version inspection and consent, preserving owner and excluding worker authority', async () => {
  render(<KontextSourceSharing owner={owner} initialResourceId={source.resourceId} />)
  expect(mocks.rpc).not.toHaveBeenCalled()
  await inspect()
  expect(button('Save model permissions').hasAttribute('disabled')).toBe(true)
  fireEvent.click(screen.getByRole('checkbox', { name: 'Codex' }))
  expect(button('Save model permissions').hasAttribute('disabled')).toBe(true)
  fireEvent.click(screen.getByRole('checkbox', { name: /I confirm/ }))
  mocks.rpc.mockResolvedValue({
    ...source,
    revision: 2,
    sharing: { dataClassification: 'internal', allowedRuntimeProviders: ['codex'] }
  })
  fireEvent.click(button('Save model permissions'))
  await screen.findByText('Saved model permissions: codex')
  expect(mocks.rpc).toHaveBeenLastCalledWith(
    owner,
    'kontext.setSourceSharing',
    {
      resourceId: source.resourceId,
      expectedRevision: 1,
      expectedContentHash: source.contentHash,
      dataClassification: 'internal',
      allowedRuntimeProviders: ['codex']
    },
    { expectedEnvironmentPairingRevision: 1, timeoutMs: 60_000 }
  )
  expect(button('Save model permissions').hasAttribute('disabled')).toBe(true)
})

it('clears consent when a provider choice changes and supports revocation for stale sources', async () => {
  mocks.rpc.mockResolvedValue({
    ...source,
    status: 'stale',
    sharing: { dataClassification: 'internal', allowedRuntimeProviders: ['codex'] }
  })
  render(<KontextSourceSharing owner={owner} initialResourceId={source.resourceId} />)
  fireEvent.click(button('Read saved permissions'))
  await screen.findByText('Saved model permissions: codex')
  fireEvent.click(screen.getByRole('checkbox', { name: /I confirm/ }))
  expect(button('Save model permissions').hasAttribute('disabled')).toBe(true)
  fireEvent.click(screen.getByRole('checkbox', { name: 'Codex' }))
  expect(screen.getByRole('checkbox', { name: /I confirm/ }).getAttribute('aria-checked')).toBe(
    'false'
  )
  fireEvent.click(screen.getByRole('checkbox', { name: /I confirm/ }))
  mocks.rpc.mockResolvedValue({
    ...source,
    revision: 2,
    status: 'stale',
    sharing: { dataClassification: 'internal', allowedRuntimeProviders: [] }
  })
  fireEvent.click(button('Save model permissions'))
  await screen.findByText('Saved model permissions: None')
  expect(mocks.rpc.mock.calls.at(-1)?.[2]).toMatchObject({ allowedRuntimeProviders: [] })
})

it('leaves a lost save acknowledgement unknown and requires a fresh read before another change', async () => {
  const view = render(<KontextSourceSharing owner={owner} initialResourceId={source.resourceId} />)
  await inspect()
  fireEvent.click(screen.getByRole('checkbox', { name: /I confirm/ }))
  mocks.rpc.mockRejectedValue(new Error('private capability'))
  fireEvent.click(button('Save model permissions'))
  await screen.findByRole('alert')
  expect(screen.queryByText(/private capability/)).toBeNull()
  expect(screen.queryByRole('button', { name: 'Save model permissions' })).toBeNull()
  view.unmount()
  render(<KontextSourceSharing owner={owner} initialResourceId={source.resourceId} />)
  expect(mocks.rpc).toHaveBeenCalledTimes(2)
})

it('rejects re-pairing before and during an operation', async () => {
  render(<KontextSourceSharing owner={owner} initialResourceId={source.resourceId} />)
  mocks.revision = 2
  fireEvent.click(button('Read saved permissions'))
  expect(mocks.rpc).not.toHaveBeenCalled()
  mocks.revision = 1
  let finish!: (value: unknown) => void
  mocks.rpc.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      })
  )
  fireEvent.click(button('Read saved permissions'))
  fireEvent.click(button('Read saved permissions'))
  mocks.revision = 2
  await act(async () => finish(source))
  expect(mocks.rpc).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('button', { name: 'Save model permissions' })).toBeNull()
  expect(screen.getByRole('alert')).toBeTruthy()
})

it('does not accept a confirmation for a different source', async () => {
  mocks.rpc.mockResolvedValue({ ...source, resourceId: 'other' })
  render(<KontextSourceSharing owner={owner} initialResourceId={source.resourceId} />)
  fireEvent.click(button('Read saved permissions'))
  await screen.findByRole('alert')
  expect(screen.queryByRole('button', { name: 'Save model permissions' })).toBeNull()
})
