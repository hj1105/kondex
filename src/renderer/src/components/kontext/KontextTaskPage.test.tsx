// @vitest-environment happy-dom

import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { KontextRuntimeInspection } from '../../../../shared/kontext-runtime-contract'

const mocks = vi.hoisted(() => ({
  inspection: {
    status: 'unavailable',
    diagnostic: 'Sidecar is offline.'
  } as KontextRuntimeInspection,
  refresh: vi.fn()
}))

vi.mock('./use-kontext-runtime-inspection', () => ({
  useKontextRuntimeInspection: () => ({
    state: { status: 'settled', value: mocks.inspection },
    refresh: mocks.refresh
  })
}))

import KontextTaskPage from './KontextTaskPage'

afterEach(() => {
  cleanup()
  mocks.refresh.mockReset()
})

describe('KontextTaskPage', () => {
  it('shows real runtime capability verdicts from Kontext', () => {
    mocks.inspection = {
      status: 'ready',
      report: {
        capabilities: [
          {
            snapshotId: 'codex-snapshot',
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
          },
          {
            snapshotId: 'claude-snapshot',
            provider: 'claude',
            cliPath: '',
            installed: false,
            authenticated: false,
            billingPath: 'unknown',
            supports: {
              structuredOutput: true,
              sessionResume: true,
              mcp: true,
              hooks: true,
              workspaceSandbox: true
            },
            inspectedAt: '2026-09-04T00:00:00.000Z',
            diagnostic: 'Claude CLI not found.'
          }
        ],
        issues: [
          {
            provider: 'claude',
            code: 'not_installed',
            message: 'Claude CLI not found.'
          }
        ],
        eligibleProviders: ['codex']
      }
    }

    render(<KontextTaskPage />)

    const report = screen.getByRole('heading', { name: 'Subscription runtimes' }).parentElement
      ?.parentElement
    if (!report) {
      throw new Error('Missing runtime report')
    }
    expect(within(report).getByText('Codex')).toBeTruthy()
    expect(screen.getByText('Ready')).toBeTruthy()
    expect(within(report).getByText('Claude')).toBeTruthy()
    expect(screen.getByText('Not installed')).toBeTruthy()
    expect(screen.getByText('Context Receipt')).toBeTruthy()
    expect(screen.queryByText('GitHub')).toBeNull()
  })

  it('does not present an unavailable sidecar as ready', () => {
    mocks.inspection = { status: 'unavailable', diagnostic: 'Sidecar is offline.' }

    render(<KontextTaskPage />)

    expect(screen.getByText('Kontext sidecar is unavailable')).toBeTruthy()
    expect(screen.getByText('Sidecar is offline.')).toBeTruthy()
    expect(screen.queryByText('Subscription runtimes')).toBeNull()
  })
})
