// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n/i18n'
import {
  sessionSourceListFixture as list,
  sessionSourcePreviewFixture as preview,
  sessionSourceRegistrationFixture as registered
} from '../../../../shared/__fixtures__/kontext-session-source'
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), revision: 1 }))
vi.mock('@/runtime/runtime-rpc-client', () => ({ callRuntimeRpc: mocks.rpc }))
vi.mock('@/runtime/runtime-environment-revision', () => ({
  getRuntimeEnvironmentRevision: () => mocks.revision
}))
import { KontextSourceRegistration } from './KontextSourceRegistration'
import { KontextSessionSourceRegistration } from './KontextSessionSourceRegistration'
const owner = { kind: 'environment' as const, environmentId: 'peer:one', pairingRevision: 1 }
beforeEach(async () => {
  mocks.revision = 1
  mocks.rpc.mockReset().mockImplementation(async (_owner, method) => {
    if (method === 'kontext.listSessionSources') {
      return list
    }
    if (method === 'kontext.previewSessionSource') {
      return preview
    }
    if (method === 'kontext.registerSessionSource') {
      return registered
    }
    throw new Error('Unexpected RPC')
  })
  await i18n.changeLanguage('en')
})
afterEach(cleanup)
async function select(session = 'session-one') {
  fireEvent.click(screen.getByRole('combobox', { name: 'Select a source session' }))
  fireEvent.change(screen.getByPlaceholderText('Search loaded sessions…'), {
    target: { value: session }
  })
  fireEvent.click(await screen.findByRole('option', { name: new RegExp(session) }))
}
async function load() {
  fireEvent.click(screen.getByRole('button', { name: 'Load readable sessions' }))
  await screen.findByRole('combobox', { name: 'Select a source session' })
}
async function read() {
  fireEvent.click(screen.getByRole('button', { name: 'Read source preview' }))
  await screen.findByRole('region', { name: 'Captured text for review' })
}
it('lists, selects, previews and registers only on explicit actions, without interpreting source markup', async () => {
  render(<KontextSessionSourceRegistration owner={owner} />)
  expect(mocks.rpc).not.toHaveBeenCalled()
  await load()
  await select()
  expect(mocks.rpc).toHaveBeenCalledTimes(1)
  await read()
  expect(screen.getByRole('region', { name: 'Captured text for review' }).textContent).toContain(
    preview.messages[0].blocks[0].text
  )
  expect(screen.queryByRole('img')).toBeNull()
  const register = screen.getByRole('button', { name: 'Register reviewed session' })
  expect(register.hasAttribute('disabled')).toBe(true)
  fireEvent.click(screen.getByRole('checkbox', { name: /I reviewed this exact/ }))
  fireEvent.click(register)
  fireEvent.click(register)
  await screen.findByText('Source snapshot registered')
  expect(mocks.rpc).toHaveBeenCalledTimes(3)
  expect(mocks.rpc).toHaveBeenLastCalledWith(
    owner,
    'kontext.registerSessionSource',
    { sessionId: 'session-one', expectedContentDigest: preview.contentDigest },
    { expectedEnvironmentPairingRevision: 1, timeoutMs: 60_000 }
  )
  expect(screen.queryByRole('region', { name: 'Captured text for review' })).toBeNull()
  expect(screen.getByLabelText('Registered Resource ID').getAttribute('value')).toBe(
    registered.resourceId
  )
})
it('clears preview and consent on selection changes, and refuses unconfirmed registration without retry', async () => {
  render(<KontextSessionSourceRegistration owner={owner} />)
  await load()
  await select()
  await read()
  fireEvent.click(screen.getByRole('checkbox', { name: /I reviewed this exact/ }))
  await select('session-two')
  expect(screen.queryByRole('checkbox')).toBeNull()
  await select()
  await read()
  expect(screen.getByRole('checkbox').getAttribute('aria-checked')).toBe('false')
  mocks.rpc.mockRejectedValueOnce(new Error('private failure'))
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: 'Register reviewed session' }))
  await screen.findByRole('alert')
  expect(screen.queryByText('Source snapshot registered')).toBeNull()
  expect(screen.queryByRole('checkbox')).toBeNull()
  expect(screen.queryByText(/private failure/)).toBeNull()
  expect(mocks.rpc).toHaveBeenCalledTimes(4)
})
it('requires host-advertised registration support and refuses changed session provenance', async () => {
  mocks.rpc.mockResolvedValueOnce({ ...list, registrationVersion: undefined })
  render(<KontextSessionSourceRegistration owner={owner} />)
  await load()
  await select()
  expect(screen.getByRole('button', { name: 'Read source preview' }).hasAttribute('disabled')).toBe(
    true
  )
  await load()
  await select()
  mocks.rpc.mockResolvedValueOnce({
    ...preview,
    origin: { ...preview.origin, runtimeId: 'replacement' }
  })
  fireEvent.click(screen.getByRole('button', { name: 'Read source preview' }))
  await screen.findByRole('alert')
  expect(screen.queryByRole('region', { name: 'Captured text for review' })).toBeNull()
})
it('discards delayed results after pairing changes or unmount without dispatching registration', async () => {
  let resolve: (value: unknown) => void = () => {}
  mocks.rpc.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done
    })
  )
  const view = render(<KontextSessionSourceRegistration owner={owner} />)
  fireEvent.click(screen.getByRole('button', { name: 'Load readable sessions' }))
  mocks.revision = 2
  await act(async () => resolve(list))
  await screen.findByRole('alert')
  expect(screen.queryByRole('combobox')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Load readable sessions' }))
  expect(mocks.rpc).toHaveBeenCalledTimes(1)
  view.unmount()
  mocks.revision = 1
  mocks.rpc.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done
    })
  )
  const next = render(<KontextSessionSourceRegistration owner={owner} />)
  fireEvent.click(screen.getByRole('button', { name: 'Load readable sessions' }))
  next.unmount()
  await act(async () => resolve(list))
  expect(screen.queryByRole('combobox')).toBeNull()
})
it('exposes session sources alongside Markdown without reading either on tab navigation', async () => {
  render(<KontextSourceRegistration owner={owner} />)
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Sessions' }), { button: 0, ctrlKey: false })
  await screen.findByRole('heading', { name: 'Session sources' })
  expect(mocks.rpc).not.toHaveBeenCalled()
  await act(async () => {
    await i18n.changeLanguage('ko')
  })
  await waitFor(() => expect(screen.getByRole('heading', { name: '세션 출처' })).toBeTruthy())
  expect(screen.getByRole('button', { name: '읽을 수 있는 세션 불러오기' })).toBeTruthy()
})
