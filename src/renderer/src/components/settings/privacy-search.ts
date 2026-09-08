// Settings-search entries for the Privacy pane. Kept in its own file to
// mirror the other per-pane search modules (notifications-search.ts,
// terminal-search.ts, etc.) and keep Settings.tsx imports uniform.

import { translate } from '@/i18n/i18n'
import { translateSearchKeyword } from './settings-search-keywords'
import { createLocalizedCatalog } from '@/i18n/localized-catalog'

export const getPrivacyPaneSearchEntries = createLocalizedCatalog(() => [
  {
    title: translate('auto.components.settings.privacy.search.5c508bad41', 'Privacy & Diagnostics'),
    description: translate(
      'auto.components.settings.privacy.search.aa3b794c17',
      'Local app diagnostics and support data controls.'
    ),
    keywords: [
      ...translateSearchKeyword('auto.components.settings.privacy.search.10124159f1', 'privacy'),
      ...translateSearchKeyword(
        'auto.components.settings.privacy.search.c0494ff48a',
        'diagnostics'
      ),
      ...translateSearchKeyword('auto.components.settings.privacy.search.1686c07fee', 'support'),
      ...translateSearchKeyword('auto.components.settings.privacy.search.3922051573', 'data')
    ]
  }
])
