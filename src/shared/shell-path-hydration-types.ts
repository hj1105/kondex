// ─── Shell PATH hydration ────────────────────────────────────────────
// Why: shared so the main-side `HydrationResult` discriminator and the
// startup runtime and local diagnostic records share one discriminator without
// `src/shared/` taking a forbidden import from `src/main/`.
export type ShellHydrationFailureReason =
  | 'none'
  | 'no_shell'
  | 'timeout'
  | 'spawn_error'
  | 'empty_path'

export type PathSource = 'shell_hydrate' | 'sync_seed_only'
