import { describe, expect, it } from 'vitest'
import {
  configureDevKontextSidecarEnvironment,
  resolveKontextSidecarSource
} from './kontext-sidecar-source.mjs'

describe('Kontext sidecar source resolution', () => {
  it('preserves an explicit valid sidecar path', () => {
    const environment = { KONDEX_KONTEXT_SIDECAR_PATH: './custom/server.mjs' }
    const result = configureDevKontextSidecarEnvironment({
      repoRoot: '/workspace/kondex',
      environment,
      isFile: (candidatePath: string) => candidatePath === '/workspace/kondex/custom/server.mjs'
    })

    expect(result).toEqual({
      status: 'configured',
      source: 'environment',
      path: '/workspace/kondex/custom/server.mjs'
    })
    expect(environment.KONDEX_KONTEXT_SIDECAR_PATH).toBe('./custom/server.mjs')
  })

  it('reports an invalid explicit path instead of silently replacing it', () => {
    expect(
      resolveKontextSidecarSource({
        repoRoot: '/workspace/kondex',
        environment: { KONDEX_KONTEXT_SIDECAR_PATH: '/missing/server.mjs' },
        isFile: () => false
      })
    ).toEqual({
      status: 'unavailable',
      source: 'environment',
      path: '/missing/server.mjs'
    })
  })

  it('discovers the sibling kontext-brain project for development', () => {
    const environment: NodeJS.ProcessEnv = {}
    const result = configureDevKontextSidecarEnvironment({
      repoRoot: '/workspace/kondex',
      environment,
      isFile: (candidatePath: string) =>
        candidatePath === '/workspace/kontext-brain-deepswe-eval/plugins/kontext-brain/server.mjs'
    })

    expect(result).toEqual({
      status: 'configured',
      source: 'sibling',
      path: '/workspace/kontext-brain-deepswe-eval/plugins/kontext-brain/server.mjs'
    })
    expect(environment.KONDEX_KONTEXT_SIDECAR_PATH).toBe(
      '/workspace/kontext-brain-deepswe-eval/plugins/kontext-brain/server.mjs'
    )
  })

  it('returns every supported sibling location when no bundle exists', () => {
    expect(
      resolveKontextSidecarSource({
        repoRoot: '/workspace/kondex',
        environment: {},
        isFile: () => false
      })
    ).toEqual({
      status: 'not_configured',
      candidates: [
        '/workspace/kontext-brain-ts/plugins/kontext-brain/server.mjs',
        '/workspace/kontext-brain-deepswe-eval/plugins/kontext-brain/server.mjs'
      ]
    })
  })
})
