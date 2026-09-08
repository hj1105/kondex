import { getAccountsPaneSearchEntries } from '@/components/settings/accounts-search'
import { getAgentsPaneSearchEntries } from '@/components/settings/agents-search'
import { getComputerUsePaneSearchEntries } from '@/components/settings/computer-use-search'
import { getGeneralPaneSearchEntries } from '@/components/settings/general-search'
import { getIntegrationsPaneSearchEntries } from '@/components/settings/integrations-search'
import { getOrchestrationPaneSearchEntries } from '@/components/settings/orchestration-search'
import { translate } from '@/i18n/i18n'
import type { SettingsNavSection } from '@/lib/settings-navigation-types'
import { Blocks, Bot, MousePointerClick, Network, SlidersHorizontal, UserCog } from 'lucide-react'
import type { SettingsNavigationBuildOptions } from './settings-navigation-build-options'

export function buildCapabilitySettingsSections({
  isLocalWindowsHost,
  isWebClient
}: SettingsNavigationBuildOptions): SettingsNavSection[] {
  const showDesktopOnlySettings = !isWebClient
  return [
    {
      id: 'agents',
      title: translate('auto.hooks.useSettingsNavigationMetadata.b49abbd2f7', 'Agents'),
      description: translate(
        'auto.hooks.useSettingsNavigationMetadata.4121f7a0a2',
        'Manage AI agents, set a default, and customize commands.'
      ),
      icon: Bot,
      searchEntries: getAgentsPaneSearchEntries({
        includeAgentAwake: !isWebClient,
        includeAgentRuntime: isLocalWindowsHost
      }),
      group: 'capabilities'
    },
    {
      id: 'accounts',
      title: translate(
        'auto.hooks.useSettingsNavigationMetadata.f70ac54d38',
        'AI Provider Accounts'
      ),
      description: translate(
        'auto.hooks.useSettingsNavigationMetadata.b1c2f8b0ac',
        'Optional account switching and usage setup for Claude and Codex.'
      ),
      icon: UserCog,
      searchEntries: getAccountsPaneSearchEntries(),
      group: 'capabilities',
      badge: translate('auto.hooks.useSettingsNavigationMetadata.7c79d3b7bf', 'Optional')
    },
    {
      id: 'orchestration',
      title: translate('auto.hooks.useSettingsNavigationMetadata.58a868e8e4', 'Orchestration'),
      description: translate(
        'auto.hooks.useSettingsNavigationMetadata.cd50cec5d7',
        'Coordinate multiple coding agents through Kondex.'
      ),
      icon: Network,
      searchEntries: getOrchestrationPaneSearchEntries({
        includeNestedWorkerDepth: !isWebClient
      }),
      group: 'capabilities'
    },
    ...(showDesktopOnlySettings
      ? [
          {
            id: 'computer-use',
            title: translate('auto.hooks.useSettingsNavigationMetadata.b35e92364b', 'Computer Use'),
            description: translate(
              'auto.hooks.useSettingsNavigationMetadata.0059bd17f3',
              'Enable agents to control any app on your computer.'
            ),
            icon: MousePointerClick,
            searchEntries: getComputerUsePaneSearchEntries(),
            group: 'capabilities'
          }
        ]
      : [])
  ]
}

export function buildSetupSettingsSections({
  isLocalWindowsHost
}: SettingsNavigationBuildOptions): SettingsNavSection[] {
  return [
    {
      id: 'general',
      title: translate('auto.hooks.useSettingsNavigationMetadata.13241992bd', 'General'),
      description: translate(
        'auto.hooks.useSettingsNavigationMetadata.2cd4ea75da',
        'Workspace defaults, app setup, and maintenance.'
      ),
      icon: SlidersHorizontal,
      searchEntries: getGeneralPaneSearchEntries({ includeProjectRuntime: isLocalWindowsHost }),
      group: 'setup'
    },
    {
      id: 'integrations',
      title: translate('auto.hooks.useSettingsNavigationMetadata.2b043783ef', 'Integrations'),
      description: translate(
        'auto.hooks.useSettingsNavigationMetadata.33a5e1d597',
        'Connect GitHub, GitLab, and source-hosting services.'
      ),
      icon: Blocks,
      searchEntries: getIntegrationsPaneSearchEntries(),
      group: 'setup'
    }
  ]
}
