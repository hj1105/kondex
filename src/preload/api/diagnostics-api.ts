import type { MemorySnapshot, StatsSummary } from '../../shared/process-stats-types'

export type StatsApi = {
  getSummary: () => Promise<StatsSummary>
}

export type DiagnosticsStatusPayload = {
  readonly bundleEnabled: boolean
  readonly disabledReason?: 'diagnostics_disabled' | 'ci'
}

export type DiagnosticsBundlePayload = {
  readonly bundleId: string
  readonly bytes: number
  readonly spanCount: number
}

export type MemoryApi = {
  getSnapshot: () => Promise<MemorySnapshot>
}

export type DiagnosticsApi = {
  getStatus: () => Promise<DiagnosticsStatusPayload>
  collectBundle: (lookbackMinutes?: number) => Promise<DiagnosticsBundlePayload>
  openBundlePreview: (bundleId: string) => Promise<void>
  discardBundlePreview: (bundleId: string) => Promise<void>
}

export type LocalDiagnosticsApi = {
  diagnostics: DiagnosticsApi
  stats: StatsApi
  memory: MemoryApi
}
