// Why: the shared budgets every hidden-window Electron probe runs under. Idle, the slowest
// arm costs ~9s, but whole-suite contention inflated arms past 30s in regression 907, so each layer
// has to clear the one below it by a load-sized margin instead of the 5s these probes started with.

/** The probe's own `app.exit(2)` guard: the innermost layer, so a stuck probe reports itself. */
export const EGRESS_PROBE_SELF_EXIT_MS = 60_000

/** The launcher's kill. Covers Chromium bootstrap before the guard's clock starts, plus shutdown. */
export const EGRESS_PROBE_BOOTSTRAP_AND_TEARDOWN_MS = 30_000

export const EGRESS_PROBE_LAUNCH_BUDGET_MS =
  EGRESS_PROBE_SELF_EXIT_MS + EGRESS_PROBE_BOOTSTRAP_AND_TEARDOWN_MS

/**
 * A liveness wait *inside* a probe: a renderer becoming ready, a guest URL becoming observable, a
 * retired guest being destroyed. Why strictly under the guard rather than equal to it: the probe
 * reports the wait's outcome as data its test asserts on (`destroyed: false`), so it has to outlive
 * the wait and write a result instead of being killed mid-wait.
 */
export const EGRESS_PROBE_INNER_WAIT_MS = EGRESS_PROBE_SELF_EXIT_MS / 2

/** Vitest budget for a test that launches `arms` probes in sequence. */
export function egressProbeTestBudgetMs(arms: number): number {
  return arms * EGRESS_PROBE_LAUNCH_BUDGET_MS + EGRESS_PROBE_BOOTSTRAP_AND_TEARDOWN_MS
}

/**
 * Bundling a probe's fixture with Vite runs in the test body, before the launcher's clock starts,
 * so no launch budget covers it. The cookie-import probes each build one, and the
 * renderer-lifecycle probe builds three.
 */
export const EGRESS_PROBE_FIXTURE_BUILD_MS = 60_000

/** Vitest budget for a test that bundles its fixture with Vite, then launches `arms` probes. */
export function bundledEgressProbeTestBudgetMs(arms: number): number {
  return egressProbeTestBudgetMs(arms) + EGRESS_PROBE_FIXTURE_BUILD_MS
}
