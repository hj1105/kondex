import { describe, expect, it, vi } from 'vitest'

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback
}))

vi.mock('@/i18n/localized-catalog', () => ({
  createLocalizedCatalog:
    <T>(loader: () => T) =>
    () =>
      loader()
}))

vi.mock('./settings-search-keywords', () => ({
  translateSearchKeyword: (_key: string, fallback: string) => [fallback]
}))

import { getAccountsCodexSearchEntries, getAccountsPaneSearchEntries } from './accounts-search'

describe('getAccountsCodexSearchEntries', () => {
  it('exposes the keywords that drive the Settings search index', () => {
    const [entry] = getAccountsCodexSearchEntries()
    // Why: the Settings search needs at least one of these tokens to
    // surface the Codex section when the user types a related term.
    expect(entry.keywords).toEqual(
      expect.arrayContaining(['codex', 'account', 'quota', 'rate limit', 'status bar'])
    )
  })

  it('is included in the rolled-up pane search entries', () => {
    const allEntries = getAccountsPaneSearchEntries()
    const titles = allEntries.map((entry) => entry.title)
    expect(titles).toContain('Codex Accounts')
    expect(titles).not.toContain('MiniMax Usage')
  })
})
