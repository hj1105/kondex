import type { OnboardingState } from '../../shared/onboarding-state-types'

export type OnboardingApi = {
  get: () => Promise<OnboardingState>
  // Why: main merges the checklist field-by-field, so a partial checklist is fine.
  update: (
    updates: Partial<Omit<OnboardingState, 'checklist'>> & {
      checklist?: Partial<OnboardingState['checklist']>
    }
  ) => Promise<OnboardingState>
}
