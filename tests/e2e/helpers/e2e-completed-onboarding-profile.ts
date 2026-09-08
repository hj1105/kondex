import { ONBOARDING_FINAL_STEP, ONBOARDING_FLOW_VERSION } from '../../../src/shared/constants'

export function getE2ECompletedOnboardingProfile() {
  return {
    // Default locators are English; locale-specific specs explicitly change this setting.
    settings: { uiLanguage: 'en' as const },
    onboarding: {
      flowVersion: ONBOARDING_FLOW_VERSION,
      closedAt: 1,
      outcome: 'completed',
      lastCompletedStep: ONBOARDING_FINAL_STEP
    },
    ui: {
      projectOrderManualDefaultNoticeDismissed: true,
      // Browser panes render this action in the toolbar. Keep it out of the
      // pointer path for tests that create splits before exercising shortcuts.
      browserImportHintHidden: true,
      // Why: E2E profiles model completed existing users and should not be
      // interrupted by the usage-display change toast covering the UI under test.
      usagePercentageDisplayChangeNoticeDismissed: true
    }
  }
}
