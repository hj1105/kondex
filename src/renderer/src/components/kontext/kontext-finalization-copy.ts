import { translate } from '@/i18n/i18n'
export function getKontextFinalizationCopy() {
  return {
    revalidate: translate('kondex.finalization.revalidate', 'Revalidate recorded completion'),
    revalidationNotice: translate(
      'kondex.finalization.revalidationNotice',
      'Explicitly reassess current code and sources. This may write audit evidence, but does not start models, grant approval or rewrite history.'
    ),
    revalidationError: translate(
      'kondex.finalization.revalidationError',
      'Current completion could not be confirmed. Read the latest record before retrying; no automatic revalidation was started.'
    ),
    current: translate('kondex.finalization.current', 'Recorded completion valid at observation'),
    changed: translate(
      'kondex.finalization.changed',
      'Recorded completion no longer matches current evidence'
    ),
    title: translate('kondex.finalization.title', 'Final completion record'),
    notice: translate(
      'kondex.finalization.notice',
      'Record completion only after all existing requirements pass. This does not grant owner approval, publish code, or bypass verification.'
    ),
    consent: translate(
      'kondex.finalization.consent',
      'I reviewed this exact completion evidence and want to record Task completion.'
    ),
    finalize: translate('kondex.finalization.finalize', 'Record Task completion'),
    recover: translate('kondex.finalization.recover', 'Recover saved finalization'),
    inspect: translate('kondex.finalization.inspect', 'Read completion record'),
    busy: translate('kondex.finalization.busy', 'Contacting the owning runtime…'),
    error: translate(
      'kondex.finalization.error',
      'Finalization was not confirmed. Read the saved record before retrying; no new request was dispatched automatically.'
    ),
    absent: translate(
      'kondex.finalization.absent',
      'No matching completion record was found. This does not prove that an in-flight request has stopped.'
    ),
    recorded: translate('kondex.finalization.recorded', 'Completion recorded at'),
    historical: translate(
      'kondex.finalization.historical',
      'Historical record. Reassess current code and sources before relying on it today.'
    ),
    storage: translate(
      'kondex.finalization.storage',
      'Recovery storage is unavailable. New finalization is disabled; existing records can still be read.'
    )
  }
}
