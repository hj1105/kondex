import type { KontextRegisteredIntegration } from '../kontext-registered-integration-contract'
export const registeredIntegrationFixture: KontextRegisteredIntegration = {
  version: 1,
  taskId: 'task:one',
  jobId: 'job:one',
  jobIdentityDigest: `sha256:${'d'.repeat(64)}`,
  observation: 'saved_metadata_only',
  currentEvidence: 'not_revalidated',
  scheduleStatus: 'completed',
  canRequestIntegration: true,
  integrationDigest: null,
  integration: null
}
export const savedIntegrationFixture: KontextRegisteredIntegration = {
  ...registeredIntegrationFixture,
  integrationDigest: `sha256:${'b'.repeat(64)}`,
  integration: {
    taskId: 'task:one',
    scheduleJobId: 'job:one',
    repositoryPath: '/host/project',
    workspacePath: '/host/integration',
    baseRevision: 'revision:one',
    gitCommit: 'commit:one',
    resultRevision: 'revision:result',
    contextDigest: 'context:one',
    changeBundleIds: ['bundle:one'],
    workItemIds: ['work:one'],
    changedPaths: ['index.ts'],
    changedSymbolIds: ['symbol:one'],
    authorProviders: ['codex'],
    createdAt: '2026-09-07T00:00:00.000Z'
  }
}
