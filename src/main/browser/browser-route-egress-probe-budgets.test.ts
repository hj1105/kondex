import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  bundledEgressProbeTestBudgetMs,
  EGRESS_PROBE_BOOTSTRAP_AND_TEARDOWN_MS,
  EGRESS_PROBE_FIXTURE_BUILD_MS,
  EGRESS_PROBE_INNER_WAIT_MS,
  EGRESS_PROBE_LAUNCH_BUDGET_MS,
  EGRESS_PROBE_SELF_EXIT_MS,
  egressProbeTestBudgetMs
} from './browser-route-egress-probe-budgets'
import { browserRouteDnsPrefetchElectronMain } from './browser-route-dns-prefetch-electron-main'
import { browserRouteH3EgressElectronMain } from './browser-route-h3-egress-electron-main'
import { persistedWorkerElectronMain } from './browser-route-persisted-worker-electron-main'
import { browserRouteWebrtcEgressElectronMain } from './browser-route-webrtc-egress-electron-main'

const BROWSER_DIR = join(import.meta.dirname, '.')
const SELF = 'browser-route-egress-probe-budgets.test.ts'

// Why an exact list rather than a "does not contain" scan: resolving the launch and then handing
// it to a private `spawnSync` is precisely how the WebRTC probe kept the 907 defect while looking
// like it shared code, and how the cookie-import and renderer-lifecycle probes kept it after that.
const PROBE_LAUNCH_OWNERS = [
  'browser-route-egress-electron-launch.ts',
  'browser-route-persisted-worker-electron-process.ts',
  'electron-probe-display-launch.test.ts',
  'electron-probe-display-launch.ts'
]

type BrowserSource = { name: string; source: string }

function browserSources(matches: (name: string) => boolean = () => true): BrowserSource[] {
  return readdirSync(BROWSER_DIR)
    .filter((name) => name.endsWith('.ts') && name !== SELF)
    .filter(matches)
    .sort()
    .map((name) => ({ name, source: readFileSync(join(BROWSER_DIR, name), 'utf8') }))
}

function isElectronProbeTest(name: string): boolean {
  return name.endsWith('.electron.test.ts')
}

describe('browser route egress probe budgets', () => {
  it('keeps the probe self-exit guard strictly inside the launcher kill', () => {
    // Regression 907: a 5s margin could not cover Chromium bootstrap and shutdown under
    // whole-suite load, so the launcher killed probes that had already written a valid result.
    expect(EGRESS_PROBE_LAUNCH_BUDGET_MS - EGRESS_PROBE_SELF_EXIT_MS).toBe(
      EGRESS_PROBE_BOOTSTRAP_AND_TEARDOWN_MS
    )
    expect(EGRESS_PROBE_BOOTSTRAP_AND_TEARDOWN_MS).toBeGreaterThanOrEqual(30_000)
    // The slowest arm costs ~9s idle and inflated past 30s under load; keep real headroom.
    expect(EGRESS_PROBE_SELF_EXIT_MS).toBeGreaterThanOrEqual(60_000)
  })

  it('keeps in-probe liveness waits strictly inside the probe self-exit guard', () => {
    // A wait that can outlast the guard turns an assertion on its outcome into a killed probe,
    // which is what the persisted-worker barrier's hardcoded 10s deadline did in run 914.
    expect(EGRESS_PROBE_INNER_WAIT_MS).toBeLessThan(EGRESS_PROBE_SELF_EXIT_MS)
    // Still far above the 5s the renderer-lifecycle probe's guest waits started with.
    expect(EGRESS_PROBE_INNER_WAIT_MS).toBeGreaterThanOrEqual(30_000)
  })

  it('gives a multi-arm test room for every arm it launches', () => {
    for (const arms of [1, 2, 4]) {
      expect(egressProbeTestBudgetMs(arms)).toBeGreaterThan(arms * EGRESS_PROBE_LAUNCH_BUDGET_MS)
    }
  })

  it('adds the fixture bundling that runs before any launcher clock starts', () => {
    // The cookie-import and renderer-lifecycle probes build their fixture with Vite inside the
    // test body, so the launcher budget never covers it and the Vitest budget has to.
    expect(EGRESS_PROBE_FIXTURE_BUILD_MS).toBeGreaterThanOrEqual(60_000)
    for (const arms of [1, 2, 4]) {
      expect(bundledEgressProbeTestBudgetMs(arms)).toBe(
        egressProbeTestBudgetMs(arms) + EGRESS_PROBE_FIXTURE_BUILD_MS
      )
    }
  })

  it('renders the shared self-exit guard into every probe main', () => {
    const mains = [
      browserRouteDnsPrefetchElectronMain(),
      browserRouteH3EgressElectronMain(),
      persistedWorkerElectronMain(),
      browserRouteWebrtcEgressElectronMain()
    ]
    for (const main of mains) {
      expect(main).toContain(`app.exit(2), ${EGRESS_PROBE_SELF_EXIT_MS}`)
    }
  })

  it('launches every Electron probe through the shared launcher', () => {
    // The WebRTC probe used spawnSync, which cannot kill Electron's process group and waits on
    // stdio EOF, so its 30s timeout overran to 68s in regression 907 and defeated the test budget.
    // The cookie-import and renderer-lifecycle probes carried the same launcher until 939, so the
    // scan covers the whole directory rather than `browser-route-*` alone. A probe test gets the
    // stricter rule: `spawnSync(\n  executable,` slipped past the original `spawnSync(executable`
    // literal on formatting alone, and a probe entrypoint has no business spawning at all.
    const offenders = browserSources()
      .filter(({ name, source }) =>
        isElectronProbeTest(name)
          ? source.includes('spawnSync')
          : source.includes('spawnSync(executable')
      )
      .map(({ name }) => name)
    expect(offenders).toEqual([])
  })

  it('keeps Electron launch resolution inside the shared launcher modules', () => {
    const owners = browserSources()
      .filter(({ source }) => source.includes('resolveElectronProbeLaunch'))
      .map(({ name }) => name)
    expect(owners).toEqual(PROBE_LAUNCH_OWNERS)
  })

  it('sources every Electron probe test budget from this module', () => {
    const missing = browserSources(isElectronProbeTest)
      .filter(({ source }) => !source.includes("from './browser-route-egress-probe-budgets'"))
      .map(({ name }) => name)
    expect(missing).toEqual([])
  })

  it('leaves no hardcoded millisecond budget in an Electron probe test', () => {
    // `}, 30000)` is the shape of both budgets regression 907 traced: the closing line of a
    // probe's own guard and of a Vitest `it`. Either one, hardcoded, sits below whole-suite
    // contention and is invisible to the layering assertions above.
    const offenders = browserSources(isElectronProbeTest).flatMap(({ name, source }) =>
      source
        .split('\n')
        .map((line, index) => `${name}:${index + 1}:${line.trim()}`)
        .filter((entry) => /:\},\s*[\d_]+\)$/.test(entry))
    )
    expect(offenders).toEqual([])
  })
})
