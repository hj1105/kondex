import type {
  Automation,
  AutomationRun,
  AutomationRunStatus
} from '../../../../shared/automations-types'
import {
  formatAutomationDateTime,
  formatAutomationRelativeTime,
  getAutomationRunStatusLabel
} from './automation-page-parts'

export type AutomationLastRunTone =
  | 'failed'
  | 'succeeded'
  | 'running'
  | 'skipped'
  | 'never'
  | 'unknown'

export type AutomationLastRunSnapshot = {
  at: number | null
  tone: AutomationLastRunTone
  statusLabel: string
}

export function indexLatestAutomationRuns(
  runs: readonly AutomationRun[]
): ReadonlyMap<string, AutomationRun> {
  const latest = new Map<string, AutomationRun>()
  for (const run of runs) {
    const existing = latest.get(run.automationId)
    if (!existing || run.createdAt > existing.createdAt) {
      latest.set(run.automationId, run)
    }
  }
  return latest
}

export function getAutomationRunLastRunAt(run: AutomationRun): number {
  return run.dispatchedAt ?? run.startedAt ?? run.createdAt
}

export function getToneForAutomationRunStatus(status: AutomationRunStatus): AutomationLastRunTone {
  if (status === 'dispatch_failed') {
    return 'failed'
  }
  if (status === 'completed') {
    return 'succeeded'
  }
  if (status === 'pending' || status === 'dispatching' || status === 'dispatched') {
    return 'running'
  }
  if (status.startsWith('skipped')) {
    return 'skipped'
  }
  return 'unknown'
}

/**
 * Last-run picture for a catalog row without any run-history fetch: the owning
 * authority projects its newest retained run into the usage summary, and a row
 * from an older server falls back to the stored `lastRunAt` timestamp alone.
 */
export function getAutomationRowLastRunSnapshot(row: {
  automation: Automation
  usageSummary: { lastRunStatus?: AutomationRunStatus | null; lastRunAt?: number | null } | null
}): AutomationLastRunSnapshot {
  const status = row.usageSummary?.lastRunStatus
  if (status) {
    return {
      at: row.usageSummary?.lastRunAt ?? row.automation.lastRunAt ?? null,
      tone: getToneForAutomationRunStatus(status),
      statusLabel: getAutomationRunStatusLabel(status)
    }
  }
  return getLocalAutomationLastRunSnapshot(row.automation, undefined)
}

export function getLocalAutomationLastRunSnapshot(
  automation: Automation,
  lastRun: AutomationRun | undefined
): AutomationLastRunSnapshot {
  if (lastRun) {
    return {
      at: getAutomationRunLastRunAt(lastRun),
      tone: getToneForAutomationRunStatus(lastRun.status),
      statusLabel: getAutomationRunStatusLabel(lastRun.status)
    }
  }
  if (automation.lastRunAt) {
    return {
      at: automation.lastRunAt,
      tone: 'unknown',
      statusLabel: ''
    }
  }
  return { at: null, tone: 'never', statusLabel: '' }
}

export function formatAutomationLastRunCell(
  snapshot: AutomationLastRunSnapshot,
  now: number
): { text: string; title: string; tone: AutomationLastRunTone } {
  const status = snapshot.statusLabel.trim()
  if (snapshot.tone === 'never') {
    const never = formatAutomationDateTime(null)
    return { text: never, title: never, tone: 'never' }
  }
  if (snapshot.at == null) {
    return { text: status || formatAutomationDateTime(null), title: status, tone: snapshot.tone }
  }
  const relative = formatAutomationRelativeTime(snapshot.at, now)
  const absolute = formatAutomationDateTime(snapshot.at)
  const text = status && relative ? `${status} ${relative}` : status || relative || absolute
  return {
    text,
    title: status ? `${status} · ${absolute}` : absolute,
    tone: snapshot.tone
  }
}
