// Protocol-only fixture: no CLI, process probe, credentials or code execution.
import { createHash } from 'node:crypto'
export function createRegisteredScheduleFixture({
  taskId,
  codeRevision,
  contextDigest,
  timestamp,
  hostToken,
  completedOlder = false
}) {
  const digest = (value) =>
    `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`
  const latest = {
    taskId,
    jobId: 'job:fixture',
    codeRevision,
    contextDigest,
    repositoryPath: '/fixture/project',
    status: 'interrupted',
    requestedAt: timestamp,
    finishedAt: timestamp,
    resumeCount: 0
  }
  const jobs = new Map([[latest.jobId, latest]])
  for (let index = 0; index < 50; index++) {
    const jobId = index === 49 ? 'job:older' : `job:history-${index}`
    const requestedAt = new Date(Date.parse(timestamp) - (index + 1) * 60_000).toISOString()
    jobs.set(jobId, {
      ...latest,
      jobId,
      requestedAt,
      finishedAt: requestedAt,
      status: completedOlder && jobId === 'job:older' ? 'completed' : 'interrupted'
    })
  }
  return {
    get count() {
      return jobs.size
    },
    get job() {
      return jobs.get(latest.jobId)
    },
    call(params) {
      const args = params.arguments ?? {}
      if (!hostToken || args.hostToken !== hostToken || args.taskId !== taskId) {
        throw new Error('Fixture registered schedule authority mismatch')
      }
      if (params.name === 'kontext_list_registered_schedules') {
        const schedules = [...jobs.values()].map(
          ({ jobId, taskId, status, requestedAt, codeRevision, contextDigest }) => ({
            jobId,
            taskId,
            status,
            requestedAt,
            codeRevision,
            contextDigest
          })
        )
        const inventoryDigest = digest(schedules)
        const limit = args.limit ?? 50
        const offset = args.cursor?.offset ?? 0
        if (args.cursor && (args.cursor.digest !== inventoryDigest || offset >= schedules.length)) {
          throw new Error('Fixture history cursor changed')
        }
        return {
          version: 1,
          taskId,
          organizationId: 'org:e2e',
          observation: 'saved_metadata_only',
          currentEvidence: 'not_revalidated',
          inventoryDigest,
          schedules: schedules.slice(offset, offset + limit),
          nextCursor:
            offset + limit < schedules.length
              ? { digest: inventoryDigest, offset: offset + limit }
              : null
        }
      }
      let job = jobs.get(args.jobId)
      if (!job) throw new Error('Fixture registered job mismatch')
      const identity = digest([taskId, job.jobId])
      let command
      if (params.name !== 'kontext_inspect_registered_schedule') {
        if (args.expectedJobIdentityDigest !== identity)
          throw new Error('Fixture reviewed identity mismatch')
        if (params.name === 'kontext_resume_registered_schedule') {
          if (args.allowSubscriptionExecution !== true)
            throw new Error('Fixture explicit consent required')
          command = { action: 'resume', resumeBlocked: true }
        } else {
          job = { ...job, cancellationRequestedAt: '2026-09-07T00:00:00.000Z' }
          jobs.set(job.jobId, job)
          command = { action: 'cancel' }
        }
      }
      return {
        version: 1,
        observation: 'saved_metadata_only',
        currentEvidence: 'not_revalidated',
        jobIdentityDigest: identity,
        diagnosticPresent: true,
        job,
        workItems: [
          {
            workItemId: 'logic:handler',
            eligibleProviders: ['codex'],
            result:
              job.status === 'completed'
                ? {
                    workItemId: 'logic:handler',
                    status: 'completed',
                    attempts: 1,
                    provider: 'codex'
                  }
                : null
          }
        ],
        ...(command ? { command } : {})
      }
    }
  }
}
