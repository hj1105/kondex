import { describe, expect, it } from 'vitest'
import { getUsageProviderAccountsSectionId } from './usage-provider-settings-target'

describe('getUsageProviderAccountsSectionId', () => {
  it('routes providers only to settings sections that exist', () => {
    expect(getUsageProviderAccountsSectionId('claude')).toBe('accounts-claude')
    expect(getUsageProviderAccountsSectionId('codex')).toBe('accounts-codex')
  })
})
