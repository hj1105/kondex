import type { PreloadApi } from '../../../../preload/api-types'
import { translate } from '@/i18n/i18n'

export function createWebDiagnosticsApi(): Partial<PreloadApi> {
  return {
    crashReports: {
      getLatestPending: () => Promise.resolve(null),
      getLatestReport: () => Promise.resolve(null),
      dismiss: () => Promise.resolve(null),
      recordRendererError: () => Promise.resolve({ ok: true, report: null, deduped: true }),
      recordBreadcrumb: () => {},
      copyLatestDiagnostics: () =>
        Promise.resolve({
          ok: false,
          error: translate('auto.web.web.preload.api.fb290366b2', 'Unavailable on web.')
        }),
      // Why: no Electron process on web; the caller falls back to performance.memory.
      readHeapStatistics: () => null
    },
    diagnostics: {
      getStatus: () =>
        Promise.resolve({
          bundleEnabled: false
        }),
      collectBundle: () => Promise.reject(new Error('Review files are unavailable on web.')),
      openBundlePreview: () => Promise.reject(new Error('Review files are unavailable on web.')),
      discardBundlePreview: () => Promise.resolve()
    }
  }
}
