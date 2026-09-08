export const planFixture = {
  request: {
    requestId: 'bb748d57-3fef-422b-b940-97499d8e6079',
    goal: 'Make total accurate',
    workspacePath: '/host/workspace',
    workspaceId: 'workspace:/host/workspace',
    sourceResourceIds: ['resource:notes'],
    provider: 'codex'
  },
  status: 'review',
  requestedAt: '2026-09-06T00:00:00.000Z',
  codeRevision: 'a'.repeat(40),
  contextDigest: `sha256:${'b'.repeat(64)}`,
  planDigest: `sha256:${'c'.repeat(64)}`,
  evidenceIds: ['evidence:notes'],
  proposal: {
    contract: {
      intent: 'Implement total',
      acceptance: [
        {
          criterionId: 'total',
          statement: 'Accurate total',
          verifier: { kind: 'test', ref: 'workspace:test' }
        }
      ],
      nonGoals: ['Do not rename total'],
      targets: ['planned:total'],
      risk: 'low'
    },
    logicPlans: [
      {
        workItemId: 'logic:total',
        plannedSymbolIds: ['planned:total'],
        allowedPaths: ['index.ts'],
        dependsOn: [],
        requiredVerifiers: [{ kind: 'typecheck', ref: 'workspace:typecheck' }],
        plannedSymbols: [
          {
            plannedSymbolId: 'planned:total',
            intendedIdentity: {
              relativePath: 'index.ts',
              kind: 'function',
              qualifiedName: 'total'
            },
            responsibility: 'Compute total'
          }
        ]
      }
    ]
  }
}
export const planApprovalFixture = {
  requestId: planFixture.request.requestId,
  planDigest: planFixture.planDigest,
  created: true,
  taskId: 'host-task:fixture',
  inspectionBasis: 'stored_context',
  inspection: {
    taskId: 'host-task:fixture',
    status: 'current',
    contract: { ...planFixture.proposal.contract, taskId: 'host-task:fixture' },
    codeRevision: planFixture.codeRevision,
    contextDigest: planFixture.contextDigest,
    requiredEvidenceIds: planFixture.evidenceIds,
    normativeRevisionCount: 0,
    conflictCount: 0,
    logic: planFixture.proposal.logicPlans.map(
      ({ workItemId, plannedSymbolIds, allowedPaths, dependsOn }) => ({
        workItemId,
        plannedSymbolIds,
        allowedPaths,
        dependsOn
      })
    )
  }
}
