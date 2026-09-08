// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n/i18n'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), revision: 1 }))
vi.mock('@/runtime/runtime-rpc-client', () => ({ callRuntimeRpc: mocks.rpc }))
vi.mock('@/runtime/runtime-environment-revision', () => ({
  getRuntimeEnvironmentRevision: () => mocks.revision
}))
import { KontextSourceRegistration } from './KontextSourceRegistration'

const result = {
  organizationId: '8f424832-cd0f-4582-bfac-360e8704d302',
  resourceId: 'resource:one',
  title: 'docs/decisions.md',
  contentHash: `sha256:${'a'.repeat(64)}`,
  changed: true,
  evidence: [{ resourceId: 'resource:one', evidenceId: 'evidence:one', chunkId: 'section:one' }],
  providerSharing: 'not_granted',
  normativeApproval: 'not_granted'
}
beforeEach(async () => {
  mocks.rpc.mockReset().mockResolvedValue(result)
  mocks.revision = 1
  await i18n.changeLanguage('en')
})
afterEach(cleanup)
function fill() {
  fireEvent.change(screen.getByLabelText('Source workspace path or selector'), {
    target: { value: '/host/folder ' }
  })
  fireEvent.change(screen.getByLabelText('Workspace-relative Markdown path'), {
    target: { value: result.title }
  })
}
const submit = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Register / refresh source' }))
describe('Kontext source registration form', () => {
  it('only registers explicitly, preserving the selected owner and path without granting model access', async () => {
    const owner = { kind: 'environment' as const, environmentId: 'peer:one', pairingRevision: 1 }
    render(<KontextSourceRegistration owner={owner} />)
    expect(mocks.rpc).not.toHaveBeenCalled()
    fill()
    submit()
    submit()
    await screen.findByText('Source snapshot registered')
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith(
      owner,
      'kontext.registerMarkdownSource',
      {
        workspace: '/host/folder ',
        relativePath: result.title
      },
      { expectedEnvironmentPairingRevision: 1, timeoutMs: 60_000 }
    )
    expect(screen.getByText(/Registration itself grants no model access/)).toBeTruthy()
    expect(screen.getByText(result.resourceId)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Workspace-relative Markdown path'), {
      target: { value: 'other.md' }
    })
    expect(screen.queryByText('Source snapshot registered')).toBeNull()
  })
  it('does not retry on error or remount and never shows an unconfirmed success', async () => {
    mocks.rpc.mockRejectedValue(new Error('Lost response with private detail'))
    const view = render(<KontextSourceRegistration owner={{ kind: 'local' }} />)
    fill()
    submit()
    await screen.findByRole('alert')
    expect(screen.getByRole('alert').textContent).toContain('Registration was not confirmed')
    expect(screen.queryByText(/private detail/)).toBeNull()
    view.unmount()
    render(<KontextSourceRegistration owner={{ kind: 'local' }} />)
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Source snapshot registered')).toBeNull()
  })
  it('rejects traversal before RPC', async () => {
    render(<KontextSourceRegistration owner={{ kind: 'local' }} />)
    fill()
    fireEvent.change(screen.getByLabelText('Workspace-relative Markdown path'), {
      target: { value: '../secret.md' }
    })
    submit()
    expect(screen.getByRole('alert').textContent).toContain('relative .md')
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('rejects a changed pairing before dispatch', async () => {
    render(
      <KontextSourceRegistration
        owner={{ kind: 'environment', environmentId: 'peer:one', pairingRevision: 1 }}
      />
    )
    fill()
    mocks.revision = 2
    submit()
    expect(screen.getByRole('alert').textContent).toContain('pairing changed')
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('rejects a changed pairing while the response is in flight', async () => {
    let complete!: (value: unknown) => void
    mocks.rpc.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve
        })
    )
    render(
      <KontextSourceRegistration
        owner={{ kind: 'environment', environmentId: 'peer:one', pairingRevision: 1 }}
      />
    )
    fill()
    submit()
    mocks.revision = 2
    await act(async () => complete(result))
    expect(screen.getByRole('alert').textContent).toContain('pairing changed')
    expect(screen.queryByText('Source snapshot registered')).toBeNull()
  })
  it.each([
    { ...result, title: 'other.md' },
    { ...result, providerSharing: 'granted' }
  ])('refuses a mismatched confirmation', async (response) => {
    mocks.rpc.mockResolvedValue(response)
    render(<KontextSourceRegistration owner={{ kind: 'local' }} />)
    fill()
    submit()
    await screen.findByRole('alert')
    expect(screen.queryByText('Source snapshot registered')).toBeNull()
  })
  it('keeps registration and no-sharing status localized in Korean', async () => {
    await i18n.changeLanguage('ko')
    render(<KontextSourceRegistration owner={{ kind: 'local' }} />)
    expect(screen.getByRole('heading', { name: 'Markdown 근거' })).toBeTruthy()
    expect(
      screen.getByText(/등록 자체로 모델 사용 권한이나 규범적 결정 승인을 부여하지 않습니다/)
    ).toBeTruthy()
  })
})
