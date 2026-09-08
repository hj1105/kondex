import { describe, expect, it } from 'vitest'
import {
  KONTEXT_SIDECAR_ENV,
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

  it('returns every supported location when no bundle exists', () => {
    expect(
      resolveKontextSidecarSource({
        repoRoot: '/workspace/kondex',
        environment: {},
        isFile: () => false
      })
    ).toEqual({
      status: 'not_configured',
      candidates: [
        '/workspace/kondex/vendor/kontext-brain/plugins/kontext-brain/server.mjs',
        '/workspace/kontext-brain-ts/plugins/kontext-brain/server.mjs',
        '/workspace/kontext-brain-deepswe-eval/plugins/kontext-brain/server.mjs'
      ]
    })
  })

  it('discovers the vendored submodule so a recursive clone works unaided', () => {
    const submodule = '/workspace/kondex/vendor/kontext-brain/plugins/kontext-brain/server.mjs'
    expect(
      resolveKontextSidecarSource({
        repoRoot: '/workspace/kondex',
        environment: {},
        isFile: (candidate) => candidate === submodule
      })
    ).toEqual({ status: 'configured', source: 'submodule', path: submodule })
  })

  it('prefers the submodule over a sibling checkout', () => {
    // Why: the submodule is pinned by the repo, so it is the reproducible one.
    expect(
      resolveKontextSidecarSource({
        repoRoot: '/workspace/kondex',
        environment: {},
        isFile: () => true
      })
    ).toMatchObject({ source: 'submodule' })
  })

  it('exports the submodule path to the dev environment, not only a sibling', () => {
    const environment: Record<string, string> = {}
    configureDevKontextSidecarEnvironment({
      repoRoot: '/workspace/kondex',
      environment,
      isFile: (candidate: string) => candidate.includes('/vendor/kontext-brain/')
    })
    expect(environment[KONTEXT_SIDECAR_ENV]).toBe(
      '/workspace/kondex/vendor/kontext-brain/plugins/kontext-brain/server.mjs'
    )
  })
})
