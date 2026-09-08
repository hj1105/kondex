import type { Automation, AutomationRun } from '../../../../shared/automations-types'
import { automationListRowKey, type AutomationListRow } from './automation-list-row-identity'

export const REPO_ID = 'repo-1'
export const WORKSPACE_ID = 'workspace-1'

export function makeAutomation(overrides: Partial<Automation> = {}): Automation {
  return {
    id: 'a-1',
    name: 'Nightly',
    prompt: 'Run the nightly sweep',
    precheck: null,
    agentId: 'claude',
    runContext: null,
    projectId: REPO_ID,
    executionTargetType: 'local',
    executionTargetId: 'local',
    schedulerOwner: 'local_host_service',
    workspaceMode: 'new_per_run',
    workspaceId: null,
    baseBranch: null,
    reuseSession: false,
    timezone: 'UTC',
    rrule: 'FREQ=DAILY;BYHOUR=9;BYMINUTE=0',
    dtstart: 1,
    enabled: true,
    nextRunAt: 2,
    missedRunPolicy: 'run_once_within_grace',
    missedRunGraceMinutes: 720,
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  }
}

export function makeAutomationListRow(
  overrides: Partial<AutomationListRow> & { hostStableKey?: string } = {}
): AutomationListRow {
  const automation = overrides.automation ?? makeAutomation()
  const hostStableKey = overrides.hostStableKey ?? 'host:desktop:self'
  return {
    key: overrides.key ?? automationListRowKey(hostStableKey, automation.id),
    automation,
    hostLabel: overrides.hostLabel ?? 'This computer',
    usageSummary: overrides.usageSummary ?? null
  }
}

export function makeRun(overrides: Partial<AutomationRun> = {}): AutomationRun {
  return {
    id: 'run-1',
    automationId: 'a-1',
    title: 'Nightly #1',
    scheduledFor: 10,
    status: 'completed',
    trigger: 'scheduled',
    workspaceId: null,
    sessionKind: 'terminal',
    chatSessionId: null,
    terminalSessionId: null,
    terminalPaneKey: null,
    terminalPtyId: null,
    outputSnapshot: null,
    precheckResult: null,
    usage: null,
    error: null,
    startedAt: 10,
    dispatchedAt: 10,
    createdAt: 10,
    ...overrides
  }
}
