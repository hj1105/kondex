import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resolveObservabilityConsent } from './index'

const CONTROLLED_ENV_NAMES = [
  'KONDEX_DIAGNOSTICS_DISABLED',
  'ORCA_DIAGNOSTICS_DISABLED',
  'ORCA_TELEMETRY_DISABLED',
  'DO_NOT_TRACK',
  'CI',
  'GITHUB_ACTIONS',
  'GITLAB_CI',
  'CIRCLECI',
  'TRAVIS',
  'BUILDKITE',
  'JENKINS_URL',
  'TEAMCITY_VERSION'
] as const

const originalEnvironment = new Map<string, string | undefined>()

beforeEach(() => {
  for (const name of CONTROLLED_ENV_NAMES) {
    originalEnvironment.set(name, process.env[name])
    delete process.env[name]
  }
})

afterEach(() => {
  for (const name of CONTROLLED_ENV_NAMES) {
    const original = originalEnvironment.get(name)
    if (original === undefined) {
      delete process.env[name]
    } else {
      process.env[name] = original
    }
  }
  originalEnvironment.clear()
})

describe('local diagnostic policy', () => {
  it('enables local diagnostics by default', () => {
    expect(resolveObservabilityConsent()).toEqual({
      localFileEnabled: true,
      bundleEnabled: true
    })
  })

  it('uses the Kondex-specific switch to disable local diagnostics', () => {
    process.env.KONDEX_DIAGNOSTICS_DISABLED = '1'

    expect(resolveObservabilityConsent()).toEqual({
      localFileEnabled: false,
      bundleEnabled: false,
      disabledReason: 'diagnostics_disabled'
    })
  })

  it('does not inherit removed Orca analytics switches', () => {
    process.env.ORCA_DIAGNOSTICS_DISABLED = '1'
    process.env.ORCA_TELEMETRY_DISABLED = '1'
    process.env.DO_NOT_TRACK = '1'

    expect(resolveObservabilityConsent()).toEqual({
      localFileEnabled: true,
      bundleEnabled: true
    })
  })

  it('keeps CI runs free of local diagnostic files', () => {
    process.env.CI = 'true'

    expect(resolveObservabilityConsent()).toEqual({
      localFileEnabled: false,
      bundleEnabled: false,
      disabledReason: 'ci'
    })
  })
})
