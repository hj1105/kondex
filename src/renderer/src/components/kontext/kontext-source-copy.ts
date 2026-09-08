import { translate } from '@/i18n/i18n'

export function getKontextSourceCopy() {
  return {
    title: translate('kondex.source.title', 'Markdown sources'),
    intro: translate(
      'kondex.source.intro',
      'Register a saved Markdown file on the selected runtime. Source registration does not create a Task.'
    ),
    workspace: translate('kondex.source.workspace', 'Source workspace path or selector'),
    path: translate('kondex.source.path', 'Workspace-relative Markdown path'),
    scope: translate(
      'kondex.source.scope',
      'Up to 512 KiB per file. General folders are supported; direct SSH and WSL sources need their own host-side integration.'
    ),
    register: translate('kondex.source.register', 'Register / refresh source'),
    busy: translate('kondex.source.busy', 'Reading and registering source…'),
    privacy: translate(
      'kondex.source.privacy',
      'Registration itself grants no model access or normative approval. Review saved model permissions below.'
    ),
    invalid: translate(
      'kondex.source.invalid',
      'Enter a workspace and a relative .md or .markdown path without traversal.'
    ),
    failed: translate(
      'kondex.source.failed',
      'Registration was not confirmed. Check the selected host and file before explicitly registering again; no automatic retry was made.'
    ),
    ownerChanged: translate(
      'kondex.source.ownerChanged',
      'The runtime pairing changed. Reload before registering a source.'
    ),
    registered: translate('kondex.source.registered', 'Source snapshot registered'),
    unchanged: translate('kondex.source.unchanged', 'Source snapshot unchanged'),
    snapshot: translate(
      'kondex.source.snapshot',
      'Captured version only; register again to check file changes.'
    ),
    resource: translate('kondex.source.resource', 'Resource ID'),
    evidence: translate('kondex.source.evidence', 'Evidence references'),
    hash: translate('kondex.source.hash', 'Content hash')
  }
}

export function getKontextSourceSharingCopy() {
  return {
    title: translate('kondex.sourceSharing.title', 'Source model permissions'),
    intro: translate(
      'kondex.sourceSharing.intro',
      'Permissions apply to the captured content version. Changed content requires new permission. This does not approve its decisions or start an agent.'
    ),
    resource: translate('kondex.sourceSharing.resource', 'Registered Resource ID'),
    inspect: translate('kondex.sourceSharing.inspect', 'Read saved permissions'),
    refresh: translate('kondex.sourceSharing.refresh', 'Recapture registered source'),
    busy: translate('kondex.sourceSharing.busy', 'Checking source on its owning runtime…'),
    failed: translate(
      'kondex.sourceSharing.failed',
      'Source operation was not confirmed. Check the host and read saved permissions before retrying; no automatic retry was made.'
    ),
    active: translate(
      'kondex.sourceSharing.active',
      'Captured source is active; this is not a live origin check.'
    ),
    stale: translate(
      'kondex.sourceSharing.stale',
      'Source needs recapture. New access cannot be granted; existing access can be revoked.'
    ),
    saved: translate('kondex.sourceSharing.saved', 'Saved model permissions'),
    none: translate('kondex.sourceSharing.none', 'None'),
    classification: translate('kondex.sourceSharing.classification', 'Data classification'),
    public: translate('kondex.sourceSharing.public', 'Public'),
    internal: translate('kondex.sourceSharing.internal', 'Internal'),
    confidential: translate('kondex.sourceSharing.confidential', 'Confidential'),
    restricted: translate('kondex.sourceSharing.restricted', 'Restricted'),
    consent: translate(
      'kondex.sourceSharing.consent',
      'I confirm these model permissions for this captured version. Selecting no models revokes access.'
    ),
    save: translate('kondex.sourceSharing.save', 'Save model permissions')
  }
}
