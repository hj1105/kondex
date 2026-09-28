import { describe, expect, it } from 'vitest'
import { describeSpawnFailure } from './kontext-sidecar-build.mjs'

describe('Kontext sidecar build step failure', () => {
  it('passes a clean exit', () => {
    expect(describeSpawnFailure({ status: 0, signal: null })).toBeNull()
  })

  it('reports a non-zero exit', () => {
    expect(describeSpawnFailure({ status: 1, signal: null })).toBe('exited with status 1')
  })

  it('reports a spawn error even though status is null', () => {
    expect(
      describeSpawnFailure({ status: null, signal: null, error: new Error('spawn pnpm ENOENT') })
    ).toBe('could not start (spawn pnpm ENOENT)')
  })

  it('reports a kill signal', () => {
    expect(describeSpawnFailure({ status: null, signal: 'SIGTERM' })).toBe('was killed by SIGTERM')
  })
})
