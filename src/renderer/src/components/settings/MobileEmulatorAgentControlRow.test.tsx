import { renderToStaticMarkup } from 'react-dom/server'
import type { ComponentProps } from 'react'
import type { BundledAgentSkillSetupPanel as NativePanel } from './BundledAgentSkillSetupPanel'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MobileEmulatorAgentControlRow } from './MobileEmulatorAgentControlRow'

const mocks = vi.hoisted(() => ({
  canUseLocalSkillFreshness: true,
  props: undefined as ComponentProps<typeof NativePanel> | undefined
}))

vi.mock('@/hooks/useActiveProjectSkillRuntime', () => ({
  useActiveProjectSkillRuntime: () => ({
    canUseLocalSkillFreshness: mocks.canUseLocalSkillFreshness,
    terminalShellOverride: undefined
  })
}))

vi.mock('../emulator-pane/use-mobile-emulator-agent-setup-state', () => ({
  useMobileEmulatorAgentSetupState: () => ({
    cliActionLabel: 'Enable',
    cliBusy: false,
    cliEnabled: true,
    cliInstallStatus: null,
    cliLoading: false,
    cliSkillError: null,
    cliSkillInstalled: true,
    cliSkillLoading: false,
    cliSupported: true,
    completedCount: 2,
    handleEnableCli: vi.fn(),
    refreshCliSkill: vi.fn(),
    step2Blocked: false
  })
}))

vi.mock('./BundledAgentSkillSetupPanel', () => ({
  BundledAgentSkillSetupPanel: (props: ComponentProps<typeof NativePanel>) => {
    mocks.props = props
    return null
  }
}))

vi.mock('./SetupStepBadge', () => ({ StepBadge: () => null }))
vi.mock('./MobileEmulatorExamples', () => ({ MobileEmulatorExamples: () => null }))

describe('MobileEmulatorAgentControlRow installation authority', () => {
  beforeEach(() => {
    mocks.canUseLocalSkillFreshness = true
    mocks.props = undefined
  })

  it('pins installation to the same device as emulator CLI discovery regardless of the active project', () => {
    renderToStaticMarkup(<MobileEmulatorAgentControlRow />)
    expect(mocks.props?.skillName).toBe('kondex-cli')
    expect(mocks.props?.targetOverride).toEqual({ kind: 'local' })
    expect(mocks.props?.runtimeOverride?.agentRuntime?.runtime).toBe('host')
    expect(mocks.props?.discoveryState?.installed).toBe(true)

    mocks.canUseLocalSkillFreshness = false
    renderToStaticMarkup(<MobileEmulatorAgentControlRow />)
    expect(mocks.props?.targetOverride).toEqual({ kind: 'local' })
    expect(mocks.props?.runtimeOverride?.agentRuntime?.runtime).toBe('host')
  })
})
