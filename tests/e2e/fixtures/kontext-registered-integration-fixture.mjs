import { createHash } from 'node:crypto'

// Protocol evidence only: no Git, verification command, model or credential access.
export function createRegisteredIntegrationFixture(schedules) {
  let integration = null
  let dispatched = false
  const digest = (value) =>
    `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`
  return {
    call(params) {
      const args = params.arguments ?? {}
      const inspected = schedules.call({
        name: 'kontext_inspect_registered_schedule',
        arguments: args
      })
      const integrationDigest = integration ? digest(integration) : null
      if (params.name === 'kontext_integrate_registered_schedule') {
        if (
          dispatched ||
          inspected.job.status !== 'completed' ||
          args.allowSubscriptionExecution !== true ||
          args.expectedJobIdentityDigest !== inspected.jobIdentityDigest ||
          args.expectedIntegrationDigest !== integrationDigest
        ) {
          throw new Error('Fixture refused duplicate or unreviewed integration')
        }
        dispatched = true
        integration = {
          taskId: args.taskId,
          scheduleJobId: args.jobId,
          repositoryPath: inspected.job.repositoryPath,
          workspacePath: '/fixture/integration',
          baseRevision: inspected.job.codeRevision,
          gitCommit: 'commit:older-integration',
          resultRevision: 'result:older',
          contextDigest: inspected.job.contextDigest,
          changeBundleIds: ['bundle:older'],
          workItemIds: ['logic:handler'],
          changedPaths: ['src/handler.ts'],
          changedSymbolIds: ['symbol:handler'],
          authorProviders: ['codex'],
          createdAt: '2026-09-07T00:00:00.000Z'
        }
        throw new Error('Fixture intentionally lost the accepted integration response')
      }
      return {
        version: 1,
        taskId: args.taskId,
        jobId: args.jobId,
        jobIdentityDigest: inspected.jobIdentityDigest,
        observation: 'saved_metadata_only',
        currentEvidence: 'not_revalidated',
        scheduleStatus: inspected.job.status,
        canRequestIntegration: inspected.job.status === 'completed',
        integrationDigest,
        integration
      }
    }
  }
}
