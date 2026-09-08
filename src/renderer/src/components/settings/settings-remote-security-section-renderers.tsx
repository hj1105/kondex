import { DeveloperPermissionsPane } from './DeveloperPermissionsPane'
import { PrivacyPane } from './PrivacyPane'
import { RuntimeEnvironmentsPane } from './RuntimeEnvironmentsPane'
import { SshPane } from './SshPane'
import { SettingsSection } from './SettingsSection'
import { translate } from '@/i18n/i18n'
import type { SettingsRenderContext } from './settings-render-context'

export function renderServersSettingsSection(context: SettingsRenderContext): React.JSX.Element {
  const { model, navigation, view } = context
  return (
    <SettingsSection
      id="servers"
      title={translate('auto.components.settings.Settings.bd0181eeca', 'Remote Kondex Servers')}
      badge="Beta"
      description={
        model.isWebClient
          ? translate(
              'auto.components.settings.Settings.7686cb5c36',
              'Connect this browser to a saved Kondex server.'
            )
          : translate(
              'auto.components.settings.Settings.b5ee17826b',
              'Pair remote Kondex runtimes for persistent sessions, richer remote state, and access from browsers or other desktop clients.'
            )
      }
      searchEntries={navigation.getSectionSearchEntries('servers')}
    >
      {view.isSectionMounted('servers') ? (
        <RuntimeEnvironmentsPane
          settings={model.settings}
          setActiveRuntimeEnvironmentPreference={model.setActiveRuntimeEnvironmentPreference}
          canGeneratePairingUrl={!model.isWebClient}
          allowLocalRuntime={!model.isWebClient}
          addServerIntentSignal={model.remoteServerAddIntentSignal}
        />
      ) : null}
    </SettingsSection>
  )
}

export function renderSshSettingsSection(context: SettingsRenderContext): React.JSX.Element | null {
  const { model, navigation, view } = context
  return model.showDesktopOnlySettings ? (
    <SettingsSection
      id="ssh"
      title={translate('auto.components.settings.Settings.9b02492d1f', 'SSH Hosts')}
      description={translate(
        'auto.components.settings.Settings.c2ee313198',
        'Use existing machines over SSH for files, terminals, Git, and workspaces.'
      )}
      searchEntries={navigation.getSectionSearchEntries('ssh')}
    >
      {view.isSectionMounted('ssh') ? (
        <SshPane addTargetIntentSignal={model.sshHostAddIntentSignal} />
      ) : null}
    </SettingsSection>
  ) : null
}

export function renderDeveloperPermissionsSettingsSection(
  context: SettingsRenderContext
): React.JSX.Element | null {
  const { model, navigation, view } = context
  return model.showDesktopOnlySettings && model.isMac ? (
    <SettingsSection
      id="developer-permissions"
      title={translate('auto.components.settings.Settings.65660d4548', 'macOS Permissions')}
      description={translate(
        'auto.components.settings.Settings.9b83cc62c2',
        'macOS privacy access for terminal-launched developer tools.'
      )}
      searchEntries={navigation.getSectionSearchEntries('developer-permissions')}
    >
      {view.isSectionMounted('developer-permissions') ? (
        <DeveloperPermissionsPane highlightedSettingId={model.highlightedSettingsTargetId} />
      ) : null}
    </SettingsSection>
  ) : null
}

export function renderPrivacySettingsSection(context: SettingsRenderContext): React.JSX.Element {
  const { navigation, view } = context
  return (
    <SettingsSection
      id="privacy"
      title={translate('auto.components.settings.Settings.d7e3f62d70', 'Privacy & Diagnostics')}
      description={translate(
        'auto.components.settings.Settings.c1b43dc4e2',
        'Local diagnostics and support data controls.'
      )}
      searchEntries={navigation.getSectionSearchEntries('privacy')}
    >
      {view.isSectionMounted('privacy') ? <PrivacyPane /> : null}
    </SettingsSection>
  )
}
