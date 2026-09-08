import { AutomationsSettingsPane } from './AutomationsSettingsPane'
import { GeneralPane } from './GeneralPane'
import { IntegrationsPane } from './IntegrationsPane'
import { SettingsSection } from './SettingsSection'
import { translate } from '@/i18n/i18n'
import type { SettingsRenderContext } from './settings-render-context'

export function renderGeneralSettingsSection(context: SettingsRenderContext): React.JSX.Element {
  const { model, interactions, navigation, terminal, view } = context
  return (
    <SettingsSection
      id="general"
      title={translate('auto.components.settings.Settings.7807c11c4d', 'General')}
      description={translate(
        'auto.components.settings.Settings.f9b77539fd',
        'Workspace defaults, app setup, and maintenance.'
      )}
      searchEntries={navigation.getSectionSearchEntries('general')}
    >
      {view.isSectionMounted('general') ? (
        <GeneralPane
          settings={model.settings}
          updateSettings={model.updateSettings}
          updateSettingsOrThrow={model.updateSettingsOrThrow}
          fontSuggestions={model.terminalFontSuggestions}
          onRequestFontSuggestions={interactions.requestFontSuggestions}
          wslSupportedPlatform={terminal.localWslSupportedPlatform}
          wslAvailable={terminal.localWindowsRuntimeCapabilities.wslAvailable}
          wslDistros={terminal.localWindowsRuntimeCapabilities.wslDistros}
          wslCapabilitiesLoading={terminal.localWindowsRuntimeCapabilities.isLoading}
        />
      ) : null}
    </SettingsSection>
  )
}

export function renderIntegrationsSettingsSection(
  context: SettingsRenderContext
): React.JSX.Element {
  const { navigation, view } = context
  return (
    <SettingsSection
      id="integrations"
      title={translate('auto.components.settings.Settings.c9ca101a3b', 'Integrations')}
      description={translate(
        'auto.components.settings.Settings.b07041697f',
        'Connect GitHub, GitLab, and source-hosting services.'
      )}
      searchEntries={navigation.getSectionSearchEntries('integrations')}
      bodyClassName="rounded-none border-0 bg-transparent p-0 shadow-none"
    >
      {view.isSectionMounted('integrations') ? <IntegrationsPane /> : null}
    </SettingsSection>
  )
}

export function renderAutomationsSettingsSection(
  context: SettingsRenderContext
): React.JSX.Element {
  const { model, navigation, view } = context
  return (
    <SettingsSection
      id="automations"
      title={translate('auto.components.settings.automations.title', 'Automations')}
      description={translate(
        'auto.components.settings.automations.description',
        'Schedule agent work and choose whether Automations appears in the sidebar.'
      )}
      searchEntries={navigation.getSectionSearchEntries('automations')}
    >
      {view.isSectionMounted('automations') ? (
        <AutomationsSettingsPane settings={model.settings} updateSettings={model.updateSettings} />
      ) : null}
    </SettingsSection>
  )
}
