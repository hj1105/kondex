import { describe, expect, it } from 'vitest'
import { selectVerifiedKontextSidecar } from './kontext-sidecar-selection.mjs'

const submodule = { source: 'submodule', path: '/repo/vendor/kontext-brain/server.mjs' }
const sibling = { source: 'sibling', path: '/sibling/server.mjs' }

describe('sidecar selection for packaging', () => {
  it('takes the pinned submodule when it serves every tool', async () => {
    const result = await selectVerifiedKontextSidecar({
      candidates: [submodule, sibling],
      exists: () => true,
      findMissingTools: async () => []
    })

    expect(result).toEqual({ chosen: submodule, rejected: [] })
  })

  it('falls back only after saying which tools the submodule lacks', async () => {
    const result = await selectVerifiedKontextSidecar({
      candidates: [submodule, sibling],
      exists: () => true,
      findMissingTools: async (path: string) =>
        path === submodule.path ? ['kontext_inspect_task'] : []
    })

    expect(result.chosen).toEqual(sibling)
    expect(result.rejected).toEqual([`${submodule.path}: does not serve kontext_inspect_task`])
  })

  it('skips a candidate that is not on disk without calling it a rejection', async () => {
    const result = await selectVerifiedKontextSidecar({
      candidates: [submodule, sibling],
      exists: (path: string) => path === sibling.path,
      findMissingTools: async () => []
    })

    expect(result).toEqual({ chosen: sibling, rejected: [] })
  })

  it('records a candidate that cannot start instead of aborting the search', async () => {
    const result = await selectVerifiedKontextSidecar({
      candidates: [submodule, sibling],
      exists: () => true,
      findMissingTools: async (path: string) => {
        if (path === submodule.path) {
          throw new Error('handshake timed out')
        }
        return []
      }
    })

    expect(result.chosen).toEqual(sibling)
    expect(result.rejected[0]).toContain('did not start')
  })

  it('reports no choice so packaging can fail instead of shipping nothing', async () => {
    const result = await selectVerifiedKontextSidecar({
      candidates: [submodule],
      exists: () => true,
      findMissingTools: async () => ['kontext_prepare_task'],
      priorRejections: ['submodule: its dependencies are missing']
    })

    expect(result.chosen).toBeNull()
    expect(result.rejected).toEqual([
      'submodule: its dependencies are missing',
      `${submodule.path}: does not serve kontext_prepare_task`
    ])
  })
})
