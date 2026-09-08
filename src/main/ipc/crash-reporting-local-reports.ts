import type { CrashReportStore } from '../crash-reporting/crash-report-store'

type CrashReportResult = Promise<Awaited<ReturnType<CrashReportStore['getLatestPending']>>>

export async function getLatestPendingReport(store: CrashReportStore): CrashReportResult {
  const reports = await store.listRecent()
  return reports.find((report) => report.status === 'pending') ?? null
}

export async function getLatestReviewableReport(store: CrashReportStore): CrashReportResult {
  const reports = await store.listRecent()
  return (
    reports.find((report) => report.status === 'pending' || report.status === 'dismissed') ?? null
  )
}

export async function getRequestedCrashReport(
  store: CrashReportStore,
  args?: { reportId?: string }
): CrashReportResult {
  if (args?.reportId) {
    return store.getById(args.reportId)
  }
  // An explicit empty request asks for a fresh local diagnostic snapshot.
  // Do not replace it with a pending crash that appears later.
  return args ? null : getLatestPendingReport(store)
}
