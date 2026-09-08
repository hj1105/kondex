import type { KontextCompletionAssessment } from '../kontext-completion-contract'

export const completionFixture: KontextCompletionAssessment = {
  taskId: 'task:completion',
  completionBasisDigest: `sha256:${'b'.repeat(64)}`,
  jobId: 'job:completion',
  observedAt: '2026-09-06T12:00:00.000Z',
  risk: 'low',
  state: 'done',
  issues: [],
  context: { status: 'current', contextDigest: 'context:one' },
  gitCommit: 'a'.repeat(40),
  codeRevision: 'workspace-revision:one',
  workspacePath: '/host/integration',
  invariantEvaluations: [],
  verificationRuns: [
    {
      verificationRunId: 'run:one',
      tier: 'full',
      verifierKind: 'test',
      verifierRef: 'workspace:test',
      result: 'passed',
      observedAt: '2026-09-06T12:00:00.000Z'
    }
  ],
  accuracyManifest: {
    manifestId: 'accuracy-manifest:one',
    taskId: 'task:completion',
    taskContractDigest: 'contract:one',
    contextDigest: 'context:one',
    baseCodeRevision: 'commit:base',
    resultCodeRevision: 'workspace-revision:one',
    normativeRevisions: [],
    evidenceIds: ['evidence:one'],
    workItemIds: ['logic:one'],
    changeBundleIds: ['bundle:one'],
    changedSymbolIds: ['symbol:one'],
    verificationRunIds: ['run:one'],
    reviewFindingIds: [],
    emergencyBypassIds: [],
    createdAt: '2026-09-06T12:00:00.000Z'
  }
}
