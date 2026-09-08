import type { SettingsSearchEntry } from './settings-search'
import { translate } from '@/i18n/i18n'
import { translateSearchKeyword } from './settings-search-keywords'
import { createLocalizedCatalog } from '@/i18n/localized-catalog'

export const getAccountsLocationSearchEntries = createLocalizedCatalog(() => [
  {
    title: translate('auto.components.settings.accounts.search.d09fb5ca92', 'Account Location'),
    description: translate(
      'auto.components.settings.accounts.search.b84a5b0c8a',
      'Choose whether provider accounts are inspected and added on this device or in WSL.'
    ),
    keywords: [
      ...translateSearchKeyword('auto.components.settings.accounts.search.06662af91e', 'account'),
      ...translateSearchKeyword('auto.components.settings.accounts.search.593720c17f', 'location'),
      ...translateSearchKeyword('auto.components.settings.accounts.search.bdbd1e668e', 'windows'),
      ...translateSearchKeyword('auto.components.settings.accounts.search.0b4d948eb5', 'wsl'),
      ...translateSearchKeyword('auto.components.settings.accounts.search.488a7e9206', 'linux'),
      ...translateSearchKeyword('auto.components.settings.accounts.search.9f70aa706c', 'provider'),
      ...translateSearchKeyword('auto.components.settings.accounts.search.e02c136ad0', 'auth')
    ]
  }
])

export const getAccountsClaudeSearchEntries = createLocalizedCatalog(() => [
  {
    title: translate('auto.components.settings.accounts.search.75682e1b62', 'Claude Accounts'),
    description: translate(
      'auto.components.settings.accounts.search.dd75a73991',
      'Optional account switching for Claude while preserving shared chat context.'
    ),
    keywords: [
      ...translateSearchKeyword('auto.components.settings.accounts.search.e14049e1a8', 'claude'),
      ...translateSearchKeyword('auto.components.settings.accounts.search.06662af91e', 'account'),
      ...translateSearchKeyword('auto.components.settings.accounts.search.5b3f18ef4a', 'switch'),
      ...translateSearchKeyword('auto.components.settings.accounts.search.8b06729e0f', 'active'),
      ...translateSearchKeyword(
        'auto.components.settings.accounts.search.86edc96bc9',
        'status bar'
      ),
      ...translateSearchKeyword('auto.components.settings.accounts.search.c759741d77', 'quota'),
      ...translateSearchKeyword('auto.components.settings.accounts.search.f2d666a886', 'optional')
    ]
  }
])

export const getAccountsCodexSearchEntries = createLocalizedCatalog(() => [
  {
    title: translate('auto.components.settings.accounts.search.17c5d244eb', 'Codex Accounts'),
    description: translate(
      'auto.components.settings.accounts.search.b40d5b6570',
      'Optional account switching for Codex and live rate limit fetching.'
    ),
    keywords: [
      ...translateSearchKeyword('auto.components.settings.accounts.search.70d1b8def5', 'codex'),
      ...translateSearchKeyword('auto.components.settings.accounts.search.06662af91e', 'account'),
      ...translateSearchKeyword(
        'auto.components.settings.accounts.search.e949b08ffb',
        'rate limit'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.accounts.search.86edc96bc9',
        'status bar'
      ),
      ...translateSearchKeyword('auto.components.settings.accounts.search.c759741d77', 'quota'),
      ...translateSearchKeyword('auto.components.settings.accounts.search.f2d666a886', 'optional'),
      ...translateSearchKeyword(
        'auto.components.settings.accounts.search.77e32a2ad3',
        'reauthenticate'
      ),
      ...translateSearchKeyword('auto.components.settings.accounts.search.02c438bc7b', 'expired'),
      ...translateSearchKeyword(
        'auto.components.settings.accounts.search.042885c07c',
        'out of date'
      )
    ]
  },
  {
    title: translate('auto.components.settings.accounts.search.a4bcfd6f86', 'Active Codex Account'),
    description: translate(
      'auto.components.settings.accounts.search.87a4a8584e',
      'Choose which optional saved Codex account powers live quota reads.'
    ),
    keywords: [
      ...translateSearchKeyword('auto.components.settings.accounts.search.70d1b8def5', 'codex'),
      ...translateSearchKeyword('auto.components.settings.accounts.search.06662af91e', 'account'),
      ...translateSearchKeyword('auto.components.settings.accounts.search.5b3f18ef4a', 'switch'),
      ...translateSearchKeyword('auto.components.settings.accounts.search.8b06729e0f', 'active'),
      ...translateSearchKeyword(
        'auto.components.settings.accounts.search.86edc96bc9',
        'status bar'
      ),
      ...translateSearchKeyword('auto.components.settings.accounts.search.f2d666a886', 'optional'),
      ...translateSearchKeyword('auto.components.settings.accounts.search.35b461d817', 'sign in')
    ]
  }
])

export const getAccountsPaneSearchEntries = createLocalizedCatalog((): SettingsSearchEntry[] => [
  ...getAccountsLocationSearchEntries(),
  ...getAccountsClaudeSearchEntries(),
  ...getAccountsCodexSearchEntries()
])
