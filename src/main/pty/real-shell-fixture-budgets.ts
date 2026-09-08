// Why: fixtures that spawn a real zsh/bash and wait on its prompt or exit. These bounds are
// liveness guards, not performance oracles — the assertions they protect check shell state and
// output content, never elapsed time — so they must clear whole-suite contention. The 5s and 2s
// they replaced passed in isolation and in run 907, then failed in the four-worker run 917.

/** Bound on one wait for a real shell's prompt, marker or exit. */
export const REAL_SHELL_WAIT_MS = 20_000

/** Vitest budget for a case built from several such waits plus shell startup. */
export const REAL_SHELL_TEST_BUDGET_MS = 60_000
