import { translate } from '@/i18n/i18n'

export function getKontextWorkbenchCopy() {
  return {
    title: translate('kondex.task.title', 'Registered tasks'),
    intro: translate(
      'kondex.task.intro',
      'Load an existing Task, or approve a new plan above. Starting implementation requires separate consent below.'
    ),
    taskId: translate('kondex.task.taskId', 'Task ID'),
    load: translate('kondex.task.load', 'Load task'),
    worktree: translate('kondex.task.worktree', 'Worktree path or selector'),
    provider: translate('kondex.task.provider', 'Implementation runtime'),
    concurrency: translate('kondex.task.concurrency', 'Concurrent workers'),
    start: translate('kondex.task.start', 'Start schedule'),
    consent: translate(
      'kondex.task.consent',
      'Allow subscription CLI execution, recovery on refresh, and required independent review.'
    ),
    saved: translate('kondex.task.saved', 'Saved requests'),
    select: translate('kondex.task.select', 'Select a request'),
    retry: translate('kondex.task.retry', 'Recover original request'),
    refresh: translate('kondex.task.refresh', 'Refresh / revalidate'),
    cancel: translate('kondex.task.cancel', 'Request cancellation'),
    integrate: translate('kondex.task.integrate', 'Integrate and verify'),
    current: translate('kondex.task.current', 'Current context'),
    unprepared: translate('kondex.task.unprepared', 'Not prepared'),
    stale: translate('kondex.task.stale', 'Stale context'),
    conflict: translate('kondex.task.conflict', 'Conflicting context'),
    inaccessible: translate('kondex.task.inaccessible', 'Access unavailable'),
    unavailable: translate('kondex.task.unavailable', 'Unavailable'),
    queued: translate('kondex.task.queued', 'Queued'),
    running: translate('kondex.task.running', 'Running'),
    cancelling: translate('kondex.task.cancelling', 'Cancellation pending'),
    completed: translate('kondex.task.completed', 'Runner finished'),
    failed: translate('kondex.task.failed', 'Execution failed'),
    interrupted: translate('kondex.task.interrupted', 'Interrupted'),
    cancelled: translate('kondex.task.cancelled', 'Cancellation confirmed'),
    pending: translate('kondex.task.pending', 'Request saved'),
    accepted: translate('kondex.task.accepted', 'Request accepted'),
    unknown: translate('kondex.task.unknown', 'Outcome unknown'),
    lastObserved: translate('kondex.task.lastObserved', 'Saved state; refresh to revalidate.'),
    taskIncomplete: translate(
      'kondex.task.taskIncomplete',
      'Runner completion is not verified Task completion.'
    ),
    evidence: translate('kondex.task.evidence', 'Required Evidence IDs'),
    revisions: translate('kondex.task.revisions', 'Normative revisions'),
    revision: translate('kondex.task.revision', 'Code revision'),
    context: translate('kondex.task.context', 'Context digest'),
    acceptance: translate('kondex.task.acceptance', 'Acceptance criteria'),
    logic: translate('kondex.task.logic', 'Logic Work Items'),
    integration: translate('kondex.task.integration', 'Integration evidence'),
    integrationNotice: translate(
      'kondex.task.integrationNotice',
      'Integration results are evidence, not a final Task completion decision.'
    ),
    ownerMissing: translate(
      'kondex.task.ownerMissing',
      'The selected runtime pairing is unavailable. Reconnect it before loading tasks.'
    ),
    noLogic: translate('kondex.task.noLogic', 'No sidecar-planned work was returned.'),
    busy: translate('kondex.task.busy', 'Processing…')
  }
}
