import type { KontextRegisteredSchedule } from '../kontext-registered-schedule-contract'
export const registeredScheduleFixture: KontextRegisteredSchedule = {
  version: 1,
  observation: 'saved_metadata_only',
  currentEvidence: 'not_revalidated',
  jobIdentityDigest: `sha256:${'d'.repeat(64)}`,
  diagnosticPresent: true,
  job: {
    jobId: 'job:one',
    taskId: 'task:one',
    status: 'interrupted',
    codeRevision: 'revision:one',
    contextDigest: 'context:one',
    repositoryPath: '/host/project',
    requestedAt: '2026-09-06T00:00:00.000Z',
    finishedAt: '2026-09-06T00:00:01.000Z',
    resumeCount: 0
  },
  workItems: [{ workItemId: 'work:one', eligibleProviders: ['codex'], result: null }]
}
