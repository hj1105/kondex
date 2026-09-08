import type { GlobalSettings } from '../../../../shared/global-settings-types'
import {
  deriveGlobalWindowsRuntimeDefaultFromLegacySettings,
  normalizeGlobalWindowsRuntimeDefault
} from '../../../../shared/project-execution-runtime'
import { toast } from 'sonner'
import type { CliInstallStatus } from '../../../../shared/cli-install-types'
import {
  isOrcaCliAvailableOnPath,
  showOrcaCliRegistrationPromptToast
} from '@/lib/agent-skill-cli-prerequisite'
import { translate } from '@/i18n/i18n'

export type LocalAgentRuntime = {
  runtime: 'host' | 'wsl'
  wslDistro?: string | null
  label: string
}

export function getHostRuntimeLabel(): string {
  return navigator.userAgent.includes('Windows') ? 'Windows' : 'This device'
}

export function getSelectedAgentRuntime(
  settings: GlobalSettings,
  wslSupportedPlatform: boolean,
  wslAvailable: boolean,
  wslCapabilitiesLoading: boolean
): LocalAgentRuntime {
  const defaultRuntime = normalizeGlobalWindowsRuntimeDefault(
    settings.localWindowsRuntimeDefault ??
      deriveGlobalWindowsRuntimeDefaultFromLegacySettings(settings, {
        wslAvailable: wslCapabilitiesLoading ? undefined : wslAvailable
      }).defaultRuntime
  )
  if (wslSupportedPlatform && defaultRuntime.kind === 'wsl') {
    const selectedDistro = defaultRuntime.distro?.trim() || null
    return {
      runtime: 'wsl',
      wslDistro: selectedDistro,
      label: selectedDistro
        ? `WSL ${selectedDistro}`
        : translate('auto.components.settings.CliSkillRuntimeSetup.c47127f222', 'WSL default')
    }
  }
  return { runtime: 'host', label: getHostRuntimeLabel() }
}

export function getWslCliDistroRequest(
  runtime?: LocalAgentRuntime
): { distro: string } | undefined {
  return runtime?.runtime === 'wsl' && runtime.wslDistro?.trim()
    ? { distro: runtime.wslDistro.trim() }
    : undefined
}

export function getSkillDiscoveryTargetForRuntime(
  runtime: LocalAgentRuntime
): { runtime: 'wsl'; wslDistro?: string | null } | undefined {
  return runtime.runtime === 'wsl'
    ? { runtime: 'wsl', wslDistro: runtime.wslDistro ?? null }
    : undefined
}

export async function ensureWslCliAvailableForAgentSkillTerminal(
  runtime?: LocalAgentRuntime
): Promise<CliInstallStatus | null> {
  const args = getWslCliDistroRequest(runtime)
  try {
    const status = await window.api.cli.getWslInstallStatus(args)
    if (!status.supported) {
      toast.warning(
        translate(
          'auto.components.settings.CliSkillRuntimeSetup.775a4cfbb8',
          'WSL shell command registration is unavailable'
        ),
        {
          description:
            status.detail ??
            translate(
              'auto.components.settings.CliSkillRuntimeSetup.fc0fcf72fd',
              'Register the WSL shell command before skill setup.'
            )
        }
      )
      return status
    }
    if (status.pathConfigured === null) {
      toast.warning(
        translate(
          'auto.components.settings.CliSkillRuntimeSetup.windowsPathUnknown',
          'WSL shell command PATH could not be checked'
        ),
        {
          description:
            status.detail ??
            translate(
              'auto.components.settings.CliSkillRuntimeSetup.refreshCliRegistration',
              'Refresh CLI registration status and try again.'
            )
        }
      )
      return status
    }
    if (status.state !== 'installed' || status.pathConfigured === false) {
      await showOrcaCliRegistrationPromptToast()
      const next = await window.api.cli.installWsl(args)
      if (!isOrcaCliAvailableOnPath(next)) {
        toast.warning(
          translate(
            'auto.components.settings.CliSkillRuntimeSetup.3728a94fb6',
            'WSL shell command needs attention'
          ),
          {
            description:
              next.detail ??
              translate(
                'auto.components.settings.CliSkillRuntimeSetup.fc0fcf72fd',
                'Register the WSL shell command before skill setup.'
              )
          }
        )
      }
      return next
    }
    return status
  } catch (error) {
    toast.error(
      error instanceof Error
        ? error.message
        : translate(
            'auto.components.settings.CliSkillRuntimeSetup.0ed08febc5',
            'Failed to register the WSL shell command.'
          )
    )
    return null
  }
}
