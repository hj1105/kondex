import { describe, expect, it } from 'vitest'
import { getNativeChatExperimentalSearchEntry } from './native-chat-experimental-search-entry'
import { matchesSettingsSearch } from './settings-search'

describe('native chat experimental search entry', () => {
  it.each(['claude', 'codex'])('matches the supported-agent keyword %s', (query) => {
    expect(matchesSettingsSearch(query, getNativeChatExperimentalSearchEntry())).toBe(true)
  })

  it.each(['openclaude', 'omp'])('does not advertise retired-agent keyword %s', (query) => {
    expect(matchesSettingsSearch(query, getNativeChatExperimentalSearchEntry())).toBe(false)
  })
})
