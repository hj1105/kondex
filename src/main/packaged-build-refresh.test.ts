import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { isPackaged: true, getAppPath: () => '/app.asar', on: vi.fn(), off: vi.fn() },
  BrowserWindow: { getAllWindows: () => [] }
}))

import {
  PACKAGED_BUILD_UPDATED_CHANNEL,
  bundleMarkerPath,
  isNewerBuild,
  registerPackagedBuildRefresh
} from './packaged-build-refresh'

type Listener = () => void

function harness(modified: () => number | null) {
  const sent: string[] = []
  const statted: string[] = []
  const focusListeners = new Set<Listener>()
  const timers: (() => void)[] = []
  const cleared: unknown[] = []
  const dispose = registerPackagedBuildRefresh({
    isPackaged: true,
    bundlePath: '/Applications/Kondex.app/Contents/Resources/app.asar',
    startedAtMs: 1_000,
    bundleModifiedAtMs: async (statPath) => {
      statted.push(statPath)
      return modified()
    },
    getWindows: () => [
      { isDestroyed: () => false, webContents: { send: (channel) => sent.push(channel) } },
      { isDestroyed: () => true, webContents: { send: () => sent.push('destroyed') } }
    ],
    focusSource: {
      on: (_event, listener) => focusListeners.add(listener),
      off: (_event, listener) => focusListeners.delete(listener)
    },
    setInterval: ((handler: () => void) => {
      timers.push(handler)
      return timers.length as unknown as ReturnType<typeof setInterval>
    }) as typeof setInterval,
    clearInterval: ((timer: unknown) => cleared.push(timer)) as typeof clearInterval
  })
  const tick = async (): Promise<void> => {
    for (const handler of timers) {
      handler()
    }
    await Promise.resolve()
    await Promise.resolve()
  }
  const focus = async (): Promise<void> => {
    for (const listener of focusListeners) {
      listener()
    }
    await Promise.resolve()
    await Promise.resolve()
  }
  return { sent, statted, tick, focus, dispose, focusListeners, cleared }
}

describe('isNewerBuild', () => {
  it('counts only a bundle written after the process started', () => {
    expect(isNewerBuild(2_000, 1_000)).toBe(true)
    expect(isNewerBuild(1_000, 1_000)).toBe(false)
    expect(isNewerBuild(500, 1_000)).toBe(false)
    // Why: an absent bundle mid-rebuild is not a new build yet.
    expect(isNewerBuild(null, 1_000)).toBe(false)
  })
})

describe('bundleMarkerPath', () => {
  it('stats the directory around an asar, whose synthetic stat would always read as new', () => {
    expect(bundleMarkerPath('/Applications/Kondex.app/Contents/Resources/app.asar')).toBe(
      '/Applications/Kondex.app/Contents/Resources'
    )
    expect(bundleMarkerPath('/checkout/out')).toBe('/checkout/out')
  })
})

describe('registerPackagedBuildRefresh', () => {
  it('announces a newer bundle once to live windows and then stops watching', async () => {
    let modified: number | null = 900
    const h = harness(() => modified)
    await h.tick()
    expect(h.sent).toEqual([])

    modified = 5_000
    await h.tick()
    expect(h.sent).toEqual([PACKAGED_BUILD_UPDATED_CHANNEL])
    expect(h.statted[0]).toBe('/Applications/Kondex.app/Contents/Resources')
    // Why: one prompt is enough; a second on every focus would nag until restart.
    await h.tick()
    await h.focus()
    expect(h.sent).toEqual([PACKAGED_BUILD_UPDATED_CHANNEL])
    expect(h.focusListeners.size).toBe(0)
    expect(h.cleared).toHaveLength(1)
  })

  it('also checks when a window gains focus, which is when a restart is least disruptive to notice', async () => {
    const h = harness(() => 5_000)
    await h.focus()
    expect(h.sent).toEqual([PACKAGED_BUILD_UPDATED_CHANNEL])
  })

  it('does nothing for an unpackaged (dev) process', () => {
    const on = vi.fn()
    const dispose = registerPackagedBuildRefresh({
      isPackaged: false,
      focusSource: { on, off: vi.fn() },
      setInterval: vi.fn() as unknown as typeof setInterval
    })
    expect(on).not.toHaveBeenCalled()
    dispose()
  })
})
