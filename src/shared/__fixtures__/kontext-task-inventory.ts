import type { KontextTaskInventory } from '../kontext-task-inventory-contract'

export const taskInventoryFixture: KontextTaskInventory = {
  version: 1,
  organizationId: 'organization:fixture',
  observation: 'saved_metadata_only',
  currentEvidence: 'not_revalidated',
  inventoryDigest: `sha256:${'a'.repeat(64)}`,
  nextCursor: null,
  tasks: [
    {
      taskId: 'task:one',
      intent: 'Preserve domain terms',
      risk: 'low',
      workspaceId: 'folder:one',
      workspacePath: '/host/project',
      createdAt: '2026-09-06T00:00:00.000Z',
      contextDigest: 'context:one',
      scheduleCount: 1,
      unsettledScheduleCount: 0,
      latestSchedule: {
        taskId: 'task:one',
        jobId: 'job:one',
        status: 'completed',
        requestedAt: '2026-09-06T00:00:01.000Z',
        codeRevision: 'revision:one',
        contextDigest: 'context:one'
      },
      integration: null,
      finalization: null
    }
  ]
}
