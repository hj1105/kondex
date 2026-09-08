import { translate } from '@/i18n/i18n'
export function getKontextRegisteredIntegrationCopy() {
  return {
    title: translate('kondex.registeredIntegration.title', 'Selected execution integration'),
    inspect: translate('kondex.registeredIntegration.inspect', 'Read saved integration'),
    notice: translate(
      'kondex.registeredIntegration.notice',
      'Read the task’s saved integration before acting. Saved metadata is not current verification or Task completion.'
    ),
    consent: translate(
      'kondex.registeredIntegration.consent',
      'Allow an integration worktree and commit, verification commands and subscription review agents. This may replace this task’s latest integration record.'
    ),
    integrate: translate(
      'kondex.registeredIntegration.integrate',
      'Integrate this reviewed execution'
    ),
    error: translate(
      'kondex.registeredIntegration.error',
      'Integration unavailable, changed or outcome unknown. Read the saved integration before another action. No automatic retry was made.'
    ),
    none: translate(
      'kondex.registeredIntegration.none',
      'No saved integration record. This does not prove that an earlier attempt made no changes.'
    ),
    other: translate(
      'kondex.registeredIntegration.other',
      'The saved integration belongs to another execution. Integrating this selection may replace that record.'
    ),
    recorded: translate('kondex.registeredIntegration.recorded', 'Saved integration time')
  }
}
