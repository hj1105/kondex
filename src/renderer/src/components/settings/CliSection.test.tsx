// @vitest-environment happy-dom

import { renderToStaticMarkup } from 'react-dom/server'
import type { ComponentProps } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDefaultSettings } from '../../../../shared/constants'
import type { BundledAgentSkillSetupPanel as NativePanel } from './BundledAgentSkillSetupPanel'
import { CliSection } from './CliSection'

const capturedPanel = vi.hoisted(() => ({
  canUseLocalSkillFreshness: true,
  props: null as null | ComponentProps<typeof NativePanel>,
  useInstalledAgentSkill: vi.fn()
}))
const toastError = vi.hoisted(() => vi.fn())

vi.mock('sonner', () => ({ toast: { error: toastError, success: vi.fn() } }))

vi.mock('@/hooks/useInstalledAgentSkills', () => ({
  GLOBAL_AGENT_SKILL_SOURCE_KINDS: ['global'],
  useInstalledAgentSkill: capturedPanel.useInstalledAgentSkill
}))

vi.mock('@/hooks/useActiveProjectSkillRuntime', () => ({
  useActiveProjectSkillRuntime: () => ({
    canUseLocalSkillFreshness: capturedPanel.canUseLocalSkillFreshness
  })
}))

capturedPanel.useInstalledAgentSkill.mockReturnValue({
  installed: false,
  loading: false,
  error: null,
  refresh: vi.fn()
})

afterEach(() => {
  cleanup()
  capturedPanel.canUseLocalSkillFreshness = true
  toastError.mockReset()
  vi.unstubAllGlobals()
})

vi.mock('./BundledAgentSkillSetupPanel', () => ({
  BundledAgentSkillSetupPanel: function BundledAgentSkillSetupPanel(
    props: ComponentProps<typeof NativePanel>
  ) {
    capturedPanel.props = props
    return <div data-testid="agent-skill-setup-panel" />
  }
}))

vi.mock('./CliRegistrationDialog', () => ({
  CliRegistrationDialog: function CliRegistrationDialog() {
    return null
  }
}))

vi.mock('./WslCliRegistration', () => ({
  WslCliRegistration: function WslCliRegistration() {
    return null
  }
}))

describe('CliSection project runtime defaults', () => {
  it('keeps the globally selected runtime explicit rather than inheriting an active project', () => {
    const settings = getDefaultSettings('/tmp')
    renderToStaticMarkup(<CliSection currentPlatform="darwin" settings={settings} />)
    expect(capturedPanel.props?.runtimeOverride?.agentRuntime?.runtime).toBe('host')
    expect(capturedPanel.props?.skillName).toBe('kondex-cli')

    capturedPanel.canUseLocalSkillFreshness = false
    renderToStaticMarkup(<CliSection currentPlatform="darwin" settings={settings} />)
    expect(capturedPanel.props?.runtimeOverride?.agentRuntime?.runtime).toBe('host')

    capturedPanel.canUseLocalSkillFreshness = true
    renderToStaticMarkup(
      <CliSection
        currentPlatform="win32"
        settings={{
          ...settings,
          localWindowsRuntimeDefault: { kind: 'wsl', distro: 'Ubuntu' }
        }}
        wslSupportedPlatform
        wslAvailable
      />
    )
    expect(capturedPanel.props?.runtimeOverride?.agentRuntime?.runtime).toBe('wsl')
  })

  it('passes the default project WSL distro to CLI skill prerequisite checks', async () => {
    const getWslInstallStatus = vi
      .fn()
      .mockResolvedValue({ supported: true, state: 'installed', pathConfigured: true })
    vi.stubGlobal('window', {
      api: {
        cli: {
          getInstallStatus: vi.fn(),
          getWslInstallStatus,
          installWsl: vi.fn()
        },
        shell: { openPath: vi.fn() }
      }
    })

    renderToStaticMarkup(
      <CliSection
        currentPlatform="win32"
        settings={{
          ...getDefaultSettings('/tmp'),
          localAgentRuntime: 'host',
          localWindowsRuntimeDefault: { kind: 'wsl', distro: 'Ubuntu' }
        }}
        wslSupportedPlatform
        wslAvailable
        wslCapabilitiesLoading={false}
      />
    )

    await capturedPanel.props?.onBeforeInstall?.()

    expect(capturedPanel.useInstalledAgentSkill).toHaveBeenCalledWith(
      'kondex-cli',
      expect.objectContaining({
        discoveryTarget: { runtime: 'wsl', wslDistro: 'Ubuntu' },
        sourceKinds: ['global']
      })
    )
    expect(capturedPanel.props?.skillName).toBe('kondex-cli')
    expect(capturedPanel.props?.runtimeOverride?.agentRuntime).toEqual({
      runtime: 'wsl',
      wslDistro: 'Ubuntu',
      label: 'WSL Ubuntu'
    })
    expect(getWslInstallStatus).toHaveBeenCalledWith({ distro: 'Ubuntu' })
    expect(getWslInstallStatus).toHaveBeenCalledTimes(1)
  })

  it('renders an inline unknown PATH state without offering a mutation', async () => {
    const getInstallStatus = vi.fn().mockResolvedValue({
      platform: 'win32',
      commandName: 'orca',
      commandPath: 'C:\\Program Files\\Orca\\resources\\bin\\orca.exe',
      pathDirectory: 'C:\\Program Files\\Orca\\resources\\bin',
      pathConfigured: null,
      launcherPath: 'C:\\Program Files\\Orca\\resources\\bin\\orca.exe',
      installMethod: 'wrapper',
      supported: true,
      state: 'installed',
      currentTarget: 'C:\\Program Files\\Orca\\resources\\bin\\orca.exe',
      unsupportedReason: null,
      detail: 'Orca could not read the Windows user PATH registry value.'
    })
    Object.assign(window, {
      api: {
        cli: {
          getInstallStatus,
          getWslInstallStatus: vi.fn(),
          install: vi.fn(),
          remove: vi.fn()
        },
        shell: { openPath: vi.fn() }
      }
    })

    render(<CliSection currentPlatform="win32" settings={getDefaultSettings('/tmp')} />)

    expect(await screen.findByText(/could not read the Windows user PATH/i)).toBeDefined()
    const registrationSwitch = screen.getByRole('switch') as HTMLButtonElement
    expect(registrationSwitch.disabled).toBe(true)
    expect(registrationSwitch.getAttribute('aria-checked')).toBe('false')
    expect(toastError).not.toHaveBeenCalled()
  })
})
