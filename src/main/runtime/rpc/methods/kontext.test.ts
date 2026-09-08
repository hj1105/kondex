import { describe, expect, it } from 'vitest'
import { KontextSidecarError } from '../../../kontext/kontext-sidecar-service'
import { ALL_RPC_METHODS } from './index'
import { inspectKontextRuntimes } from './kontext'

const REPORT = {
  capabilities: [
    {
      snapshotId: 'snapshot-codex',
      provider: 'codex',
      cliPath: '/usr/local/bin/codex',
      cliVersion: '1.2.3',
      installed: true,
      authenticated: true,
      billingPath: 'subscription',
      supports: {
        structuredOutput: true,
        sessionResume: true,
        mcp: true,
        hooks: true,
        workspaceSandbox: true
      },
      inspectedAt: '2026-09-04T00:00:00.000Z'
    }
  ],
  issues: [],
  eligibleProviders: ['codex']
} as const

describe('kontext runtime RPC', () => {
  it('publishes the runtime inspection method', () => {
    expect(ALL_RPC_METHODS.some((method) => method.name === 'kontext.inspectRuntimes')).toBe(true)
  })

  it('accepts a valid structured runtime report', async () => {
    await expect(inspectKontextRuntimes({ inspectRuntimes: async () => REPORT })).resolves.toEqual({
      status: 'ready',
      report: REPORT
    })
  })

  it('does not expose malformed structured content as ready', async () => {
    await expect(
      inspectKontextRuntimes({ inspectRuntimes: async () => ({ eligibleProviders: ['codex'] }) })
    ).resolves.toEqual({
      status: 'unavailable',
      diagnostic: 'Kontext returned an invalid runtime capability report.'
    })
  })

  it('preserves the configured versus unavailable distinction', async () => {
    await expect(
      inspectKontextRuntimes({
        inspectRuntimes: async () => {
          throw new KontextSidecarError('not_configured', 'No sidecar configured.')
        }
      })
    ).resolves.toEqual({ status: 'not_configured', diagnostic: 'No sidecar configured.' })
  })
})
