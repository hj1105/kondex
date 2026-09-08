import { translate } from '@/i18n/i18n'
export function getKontextSessionSourceCopy() {
  return {
    tab: translate('kondex.sessionSource.tab', 'Sessions'),
    markdown: translate('kondex.sessionSource.markdown', 'Markdown files'),
    title: translate('kondex.sessionSource.title', 'Session sources'),
    intro: translate(
      'kondex.sessionSource.intro',
      'Use text from a readable native session on the selected runtime. Nothing is read or registered automatically.'
    ),
    list: translate('kondex.sessionSource.list', 'Load readable sessions'),
    select: translate('kondex.sessionSource.select', 'Select a source session'),
    search: translate('kondex.sessionSource.search', 'Search loaded sessions…'),
    empty: translate(
      'kondex.sessionSource.empty',
      'No matching readable sessions. Open the session on its owning runtime, then reload this list.'
    ),
    preview: translate('kondex.sessionSource.preview', 'Read source preview'),
    consent: translate(
      'kondex.sessionSource.consent',
      'I reviewed this exact captured text and its exclusions. Register it as a private source; do not grant model access or approve decisions.'
    ),
    register: translate('kondex.sessionSource.register', 'Register reviewed session'),
    scope: translate(
      'kondex.sessionSource.scope',
      'Only stored user and assistant text is included—not tools, reasoning, images, execution approvals or unconfirmed submissions. Maximum 256 messages and 512 KiB; this is not the full raw provider transcript.'
    ),
    provenance: translate('kondex.sessionSource.provenance', 'Captured source provenance'),
    exclusions: translate(
      'kondex.sessionSource.exclusions',
      'Excluded items / blocks / unconfirmed submissions'
    ),
    review: translate('kondex.sessionSource.review', 'Captured text for review'),
    failed: translate(
      'kondex.sessionSource.failed',
      'The operation was not confirmed. Reload the list and preview again; older or disconnected hosts may not support it. No automatic retry was made.'
    ),
    unsupported: translate(
      'kondex.sessionSource.unsupported',
      'This host has not confirmed session registration support. Update the owning runtime before registering; Markdown sources remain available.'
    ),
    ownerChanged: translate(
      'kondex.sessionSource.ownerChanged',
      'The owning runtime pairing changed. Reload this view before continuing.'
    ),
    busy: translate('kondex.sessionSource.busy', 'Contacting the owning session runtime…'),
    legacyInventory: translate(
      'kondex.sessionSource.legacyInventory',
      'Session inclusion is unconfirmed on this host. This list may contain only Markdown sources; update the owning runtime for session selection.'
    )
  }
}
