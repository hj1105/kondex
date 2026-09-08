import { registeredScheduleFixture } from './kontext-registered-schedule'
import type { KontextScheduleHistory } from '../kontext-schedule-history-contract'

export const scheduleHistoryFixture: KontextScheduleHistory = {
  version: 1,
  taskId: registeredScheduleFixture.job.taskId,
  organizationId: 'org:one',
  observation: 'saved_metadata_only',
  currentEvidence: 'not_revalidated',
  inventoryDigest: `sha256:${'a'.repeat(64)}`,
  nextCursor: null,
  schedules: [
    registeredScheduleFixture.job,
    {
      ...registeredScheduleFixture.job,
      jobId: 'job:older',
      requestedAt: '2026-09-05T00:00:00.000Z'
    }
  ]
}
