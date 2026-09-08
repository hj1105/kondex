import { translate } from '@/i18n/i18n'
export function getKontextRegisteredScheduleCopy() {
  return {
    title: translate('kondex.registeredSchedule.title', 'Host execution record'),
    notice: translate(
      'kondex.registeredSchedule.notice',
      'Saved state is not proof that workers are live or stopped. Reading does not resume execution. Revalidation/resume may start subscription coding agents.'
    ),
    inspect: translate('kondex.registeredSchedule.inspect', 'Read saved execution'),
    busy: translate('kondex.registeredSchedule.busy', 'Contacting the owning execution host…'),
    error: translate(
      'kondex.registeredSchedule.error',
      'The operation could not be confirmed. Inspect saved state before retrying; no automatic retry was made.'
    ),
    status: translate('kondex.registeredSchedule.status', 'Saved status'),
    cancellation: translate('kondex.registeredSchedule.cancellation', 'Cancellation requested at'),
    resumes: translate('kondex.registeredSchedule.resumes', 'Recorded resume count'),
    result: translate('kondex.registeredSchedule.result', 'Saved Work Item result'),
    blocked: translate(
      'kondex.registeredSchedule.blocked',
      'Resume blocked by existing validation. Check context, permissions and leases before retrying.'
    ),
    returned: translate(
      'kondex.registeredSchedule.returned',
      'The request returned saved state. This does not prove that a worker started or stopped.'
    ),
    consent: translate(
      'kondex.registeredSchedule.consent',
      'Allow the stored provider choices and inputs to be revalidated and resumed using my subscription.'
    ),
    resume: translate('kondex.registeredSchedule.resume', 'Revalidate / resume this execution'),
    cancel: translate('kondex.registeredSchedule.cancel', 'Request execution cancellation')
  }
}
