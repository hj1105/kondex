// Seeded protocol evidence only; no project verification or model execution occurs.
export function createFinalizationFixture({ taskId, contextDigest, timestamp, hostToken }) {
  const basis = `sha256:${'b'.repeat(64)}`
  const manifest = {
    manifestId: 'accuracy-manifest:fixture',
    taskId,
    taskContractDigest: 'contract:fixture',
    contextDigest,
    baseCodeRevision: 'revision:fixture',
    resultCodeRevision: 'result:fixture',
    normativeRevisions: [],
    evidenceIds: ['evidence:fixture'],
    workItemIds: ['logic:handler'],
    changeBundleIds: ['bundle:fixture'],
    changedSymbolIds: ['symbol:handler'],
    verificationRunIds: ['run:fixture'],
    reviewFindingIds: [],
    emergencyBypassIds: [],
    createdAt: timestamp
  }
  let record = null
  return {
    assess(job) {
      return {
        taskId,
        jobId: job.jobId,
        completionBasisDigest: basis,
        observedAt: timestamp,
        risk: 'low',
        state: 'done',
        issues: [],
        context: { status: 'current', contextDigest },
        gitCommit: 'commit:fixture',
        codeRevision: 'result:fixture',
        workspacePath: job.repositoryPath,
        invariantEvaluations: [],
        accuracyManifest: manifest,
        verificationRuns: [
          {
            verificationRunId: 'run:fixture',
            tier: 'full',
            verifierKind: 'test',
            verifierRef: 'fixture:preseeded-not-real-verification',
            result: 'passed',
            observedAt: timestamp
          }
        ]
      }
    },
    call(params, job) {
      const args = params.arguments ?? {}
      if (!hostToken || args.hostToken !== hostToken || args.taskId !== taskId) {
        throw new Error('Finalization fixture host authority required')
      }
      if (params.name === 'kontext_inspect_finalization') {
        return {
          taskId,
          record: !args.requestId || args.requestId === record?.request.requestId ? record : null,
          currentEvidence: 'not_revalidated'
        }
      }
      if (params.name === 'kontext_revalidate_finalization') {
        if (!record || args.expectedRecordId !== record.recordId) {
          throw new Error('Revalidation fixture record mismatch')
        }
        return {
          taskId,
          recordId: record.recordId,
          currentEvidence: 'revalidated_current',
          recordedCompletionBasisDigest: basis,
          observedCompletionBasisDigest: basis,
          observedAt: timestamp,
          state: 'done',
          issueCount: 0,
          codeRevision: record.codeRevision,
          contextDigest,
          contextStatus: 'current'
        }
      }
      if (
        args.jobId !== job?.jobId ||
        args.expectedCompletionBasisDigest !== basis ||
        !args.requestId
      ) {
        throw new Error('Finalization fixture request mismatch')
      }
      const request = {
        taskId,
        jobId: args.jobId,
        requestId: args.requestId,
        expectedCompletionBasisDigest: basis
      }
      if (record) {
        if (JSON.stringify(record.request) !== JSON.stringify(request)) {
          throw new Error('Finalization fixture refused a different request')
        }
        return { created: false, record, currentEvidence: 'not_revalidated' }
      }
      record = {
        schemaVersion: 1,
        recordId: `sha256:${'f'.repeat(64)}`,
        organizationId: 'org:fixture',
        subjectId: 'user:fixture',
        request,
        codeRevision: 'result:fixture',
        contextDigest,
        gitCommit: 'commit:fixture',
        accuracyManifestId: manifest.manifestId,
        accuracyManifest: manifest,
        verificationRunIds: ['run:fixture'],
        completedAt: timestamp
      }
      throw new Error('Fixture recorded finalization but lost its acknowledgement')
    }
  }
}
