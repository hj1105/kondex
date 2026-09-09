// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ toast: vi.fn() }))
vi.mock('sonner', () => ({ toast: mocks.toast }))

import { i18n } from '@/i18n/i18n'
import { PackagedBuildUpdateNoticeHost } from './PackagedBuildUpdateNoticeHost'

type Listener = () => void

beforeEach(async () => {
  await i18n.changeLanguage('en')
  mocks.toast.mockReset()
})
afterEach(() => {
  cleanup()
  // @ts-expect-error test teardown of the preload surface
  delete window.api
})

describe('PackagedBuildUpdateNoticeHost', () => {
  it('shows one sticky restart offer when main reports a newer bundle, and unsubscribes on unmount', () => {
    const listeners = new Set<Listener>()
    const relaunch = vi.fn().mockResolvedValue(undefined)
    Object.assign(window, {
      api: {
        app: { relaunch },
        ui: {
          onPackagedBuildUpdated: (listener: Listener) => {
            listeners.add(listener)
            return () => listeners.delete(listener)
          }
        }
      }
    })
    const view = render(<PackagedBuildUpdateNoticeHost />)
    expect(listeners.size).toBe(1)
    for (const listener of listeners) {
      listener()
    }
    expect(mocks.toast).toHaveBeenCalledTimes(1)
    const [title, options] = mocks.toast.mock.calls[0] as [string, Record<string, unknown>]
    expect(title).toBe('A newer Kondex build is installed')
    expect(options.duration).toBe(Number.POSITIVE_INFINITY)
    const action = options.action as { label: string; onClick: () => void }
    expect(action.label).toBe('Restart now')
    action.onClick()
    expect(relaunch).toHaveBeenCalledTimes(1)
    view.unmount()
    expect(listeners.size).toBe(0)
  })

  it('renders nothing where the preload has no such event, such as the web client', () => {
    Object.assign(window, { api: { app: { relaunch: vi.fn() }, ui: {} } })
    render(<PackagedBuildUpdateNoticeHost />)
    expect(mocks.toast).not.toHaveBeenCalled()
  })
})
