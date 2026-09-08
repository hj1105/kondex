import { describe, expect, it } from 'vitest'
import { normalizeFeatureTipIds } from './feature-tips'

describe('legacy feature tip ids', () => {
  it('normalizes persisted ids by removing unknowns and duplicates', () => {
    expect(
      normalizeFeatureTipIds(['feature-tour', 'orca-cli', 'bogus', 'cmd-j-palette', 'orca-cli'])
    ).toEqual(['orca-cli', 'cmd-j-palette'])
  })
})
