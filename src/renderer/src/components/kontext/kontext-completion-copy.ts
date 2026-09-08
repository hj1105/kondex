import { translate } from '@/i18n/i18n'

export function getKontextCompletionCopy() {
  return {
    title: translate('kondex.completion.title', 'Task completion evidence'),
    notice: translate(
      'kondex.completion.notice',
      'Assess the stored integration against current code and sources. This writes manifest audit evidence, but does not run models or tests, grant owner approval, or publish code. The verdict is valid at the observation time; reassess after changes.'
    ),
    assess: translate('kondex.completion.assess', 'Assess completion'),
    busy: translate('kondex.completion.busy', 'Checking evidence on the owning runtime…'),
    error: translate(
      'kondex.completion.error',
      'Completion could not be confirmed. No successful verdict is retained. Check the owning runtime and integration, then request a fresh assessment.'
    ),
    observed: translate('kondex.completion.observed', 'Observed at'),
    commit: translate('kondex.completion.commit', 'Integrated commit'),
    context: translate('kondex.completion.context', 'Context'),
    verification: translate('kondex.completion.verification', 'Current verification evidence'),
    evidence: translate(
      'kondex.completion.evidence',
      'Invariant evaluations and Accuracy Manifest'
    ),
    done: translate('kondex.completion.done', 'Completion requirements met at observation'),
    blocked: translate('kondex.completion.blocked', 'Completion blocked'),
    awaiting_evidence: translate(
      'kondex.completion.awaiting_evidence',
      'Awaiting completion evidence or owner approval'
    ),
    planned: translate('kondex.completion.planned', 'Planned; not complete'),
    in_progress: translate('kondex.completion.in_progress', 'In progress; not complete')
  }
}
