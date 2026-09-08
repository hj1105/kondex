import { translate } from '@/i18n/i18n'

export function getBundledSkillSetupCopy() {
  return {
    codex: translate('kondex.nativeSkills.codex', 'Codex'),
    claude: translate('kondex.nativeSkills.claude', 'Claude'),
    selectRuntime: translate(
      'kondex.nativeSkills.selectRuntime',
      'Select a runtime before installing.'
    ),
    setupFirst: translate(
      'kondex.nativeSkills.setupFirst',
      'Complete the preceding setup step first.'
    ),
    installFailed: translate('kondex.nativeSkills.installFailed', 'Skill installation failed.'),
    recheckFailed: translate('kondex.nativeSkills.recheckFailed', 'Skill re-check failed.'),
    checking: translate('kondex.nativeSkills.checking', 'Checking…'),
    installed: translate('kondex.nativeSkills.installed', 'Installed'),
    unknown: translate('kondex.nativeSkills.unknown', 'Unknown'),
    notInstalled: translate('kondex.nativeSkills.notInstalled', 'Not installed'),
    here: translate('kondex.nativeSkills.here', 'this runtime'),
    integrations: translate('kondex.nativeSkills.integrations', 'Agent integrations'),
    installing: translate('kondex.nativeSkills.installing', 'Installing…'),
    update: translate('kondex.nativeSkills.update', 'Update'),
    install: translate('kondex.nativeSkills.install', 'Install'),
    recheck: translate('kondex.nativeSkills.recheck', 'Re-check')
  }
}

export function bundledSkillInstallDescription(runtimeLabel: string): string {
  return translate(
    'kondex.nativeSkills.destination',
    'Bundled with Kondex. Installs on {{runtime}}. The universal skills directory is always included. Existing local edits are preserved. Using the skill also requires the Kondex CLI on that machine.',
    { runtime: runtimeLabel }
  )
}

export function missingBundledSkillResult(status: string): string {
  return translate(
    'kondex.nativeSkills.missingResult',
    'Install {{status}}; no skill result was returned.',
    { status }
  )
}
