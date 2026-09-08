import type { KontextSourceInventory } from '../kontext-source-contract'
export const sourceInventoryFixture: KontextSourceInventory = {
  organizationId: '8f424832-cd0f-4582-bfac-360e8704d302',
  inventoryDigest: `sha256:${'a'.repeat(64)}`,
  observation: 'saved_metadata_only',
  nextCursor: null,
  sources: [
    {
      organizationId: '8f424832-cd0f-4582-bfac-360e8704d302',
      resourceId: 'resource:notes',
      title: 'notes.md',
      workspacePath: '/host/folder',
      relativePath: 'notes.md',
      contentHash: `sha256:${'b'.repeat(64)}`,
      revision: 2,
      status: 'active',
      sharing: { dataClassification: 'internal', allowedRuntimeProviders: ['codex'] },
      normativeApproval: 'not_granted'
    }
  ]
}
