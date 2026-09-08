// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  listLocalNetworkInterfaces: vi.fn(),
  listLocalAccessGrants: vi.fn(),
  createLocalAccessLink: vi.fn()
}))

vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('./RuntimeAccessGrantList', () => ({ RuntimeAccessGrantList: () => null }))
vi.mock('./RuntimePairingGeneratorForm', () => ({
  RuntimePairingGeneratorForm: (props: { selectedAddress: string; onGenerate: () => void }) => (
    <div>
      <div data-testid="selected-address">{props.selectedAddress}</div>
      <button type="button" onClick={props.onGenerate}>
        Generate
      </button>
    </div>
  )
}))

import { RuntimePairingUrlGenerator } from './RuntimePairingUrlGenerator'
import { runtimePairingLinkCache } from './runtime-pairing-link-state'

describe('RuntimePairingUrlGenerator', () => {
  beforeEach(() => {
    runtimePairingLinkCache.selectedAddress = '100.76.32.125'
    runtimePairingLinkCache.customAddress = ''
    runtimePairingLinkCache.intent = 'another'
    runtimePairingLinkCache.generatedAddress = null
    runtimePairingLinkCache.runtimePairingUrl = null
    runtimePairingLinkCache.webClientUrl = null
    runtimePairingLinkCache.runtimePairingDeviceId = null
    mocks.listLocalNetworkInterfaces.mockReset()
    mocks.listLocalAccessGrants.mockReset().mockResolvedValue({ grants: [] })
    mocks.createLocalAccessLink.mockReset().mockResolvedValue({
      available: true,
      pairingUrl: 'orca://pair#runtime',
      webClientUrl: 'http://127.0.0.1:6768/web-index.html?pairing=runtime',
      endpoint: 'ws://127.0.0.1:6768',
      deviceId: 'runtime-1'
    })
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        runtimeEnvironments: {
          listLocalNetworkInterfaces: mocks.listLocalNetworkInterfaces,
          listLocalAccessGrants: mocks.listLocalAccessGrants,
          createLocalAccessLink: mocks.createLocalAccessLink
        }
      }
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('keeps the cached address while interfaces are loading', async () => {
    let resolveInterfaces!: (value: { interfaces: { name: string; address: string }[] }) => void
    mocks.listLocalNetworkInterfaces.mockReturnValue(
      new Promise((resolve) => {
        resolveInterfaces = resolve
      })
    )

    render(<RuntimePairingUrlGenerator />)
    await waitFor(() => expect(mocks.listLocalNetworkInterfaces).toHaveBeenCalledOnce())
    expect(screen.getByTestId('selected-address')).toHaveTextContent('100.76.32.125')

    resolveInterfaces({
      interfaces: [{ name: 'tailscale0', address: '100.76.32.125' }]
    })
    await waitFor(() =>
      expect(screen.getByTestId('selected-address')).toHaveTextContent('100.76.32.125')
    )
  })

  // Why: the main process gates the one-way network widen on the declared reach, so dropping it (as the
  // component used to) leaves main guessing from the address string — "This computer only" then widened,
  // and a Custom loopback tunnel front-end would not.
  it.each([
    ['local' as const, '127.0.0.1', 'this-computer'],
    ['another' as const, '100.76.32.125', 'network'],
    ['custom' as const, '127.0.0.1:8443', 'network']
  ])('sends the %s reach with the address', async (intent, address, reach) => {
    runtimePairingLinkCache.intent = intent
    runtimePairingLinkCache.selectedAddress = address
    mocks.listLocalNetworkInterfaces.mockResolvedValue({
      interfaces: [{ name: 'tailscale0', address: '100.76.32.125' }]
    })

    render(<RuntimePairingUrlGenerator />)
    await waitFor(() => expect(mocks.listLocalNetworkInterfaces).toHaveBeenCalledOnce())

    screen.getByRole('button', { name: 'Generate' }).click()

    await waitFor(() =>
      expect(mocks.createLocalAccessLink).toHaveBeenCalledWith({ address, rotate: true, reach })
    )
  })
})
