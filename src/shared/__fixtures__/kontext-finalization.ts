import { completionFixture } from './kontext-completion'
import { kontextAccuracyManifestSchema } from '../kontext-completion-contract'
import { kontextFinalizationRecordSchema } from '../kontext-finalization-contract'

export const finalizationFixture = kontextFinalizationRecordSchema.parse({
  schemaVersion: 1,
  recordId: `sha256:${'f'.repeat(64)}`,
  organizationId: 'org:fixture',
  subjectId: 'user:fixture',
  request: {
    taskId: completionFixture.taskId,
    jobId: completionFixture.jobId,
    requestId: 'c6f9ef06-51df-4e7d-a6c9-4a52b4c7e941',
    expectedCompletionBasisDigest: completionFixture.completionBasisDigest
  },
  codeRevision: completionFixture.codeRevision,
  contextDigest: completionFixture.context.contextDigest,
  gitCommit: completionFixture.gitCommit,
  accuracyManifestId: 'accuracy-manifest:one',
  accuracyManifest: kontextAccuracyManifestSchema.parse(completionFixture.accuracyManifest),
  verificationRunIds: ['run:one'],
  completedAt: completionFixture.observedAt
})
