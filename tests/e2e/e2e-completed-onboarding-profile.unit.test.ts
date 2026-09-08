import { describe, expect, it } from 'vitest'
import { getE2ECompletedOnboardingProfile } from './helpers/e2e-completed-onboarding-profile'

describe('isolated E2E profile', () => {
  it('pins the language of default DOM locators without depending on the host locale', () => {
    expect(getE2ECompletedOnboardingProfile()).toMatchObject({
      settings: { uiLanguage: 'en' },
      onboarding: { outcome: 'completed' }
    })
  })

  it('creates independent profile objects for separate runs', () => {
    const first = getE2ECompletedOnboardingProfile()
    const second = getE2ECompletedOnboardingProfile()
    first.ui.browserImportHintHidden = false
    expect(second.ui.browserImportHintHidden).toBe(true)
    expect(first.settings).not.toBe(second.settings)
  })
})
