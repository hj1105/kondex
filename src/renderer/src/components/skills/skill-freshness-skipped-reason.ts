import { buildAgentFeatureSkillInstallCommand } from '../../../../shared/agent-feature-install-commands'
import type { SkillLocationChip, SkillLocationRow } from './skill-freshness-grouping'
import { translate } from '@/i18n/i18n'

// Why: a skill is skipped for one concrete reason; lead with the highest-priority
// blocking placement so the sentence explains the real cause (an edited copy is
// more useful to surface than a downstream symptom).
const SKIPPED_REASON_PRIORITY: SkillLocationChip[] = [
  'unrecognized',
  'read-only',
  'inaccessible',
  // Why: above the placement chips — a copy that is ahead of this build must never
  // fall through to the reinstall advice below, which would roll it back.
  'newer',
  'in-a-repo',
  'plugin-cache',
  'external-link',
  'broken-link',
  // Why: lowest priority — a stale duplicate only explains the skip once no
  // harder blocker is present, since the others describe a more specific cause.
  'duplicate'
]

// Why: a location the global update never judged cannot be why the skill was skipped, so it
// must not outrank the placement that was — nor the ABSENCE of a chip, which is how the
// stale-record remedy below is reached. The fallback keeps the sentence total.
function blockingChip(locations: readonly SkillLocationRow[]): SkillLocationChip | undefined {
  const judged = locations.filter((location) => location.participatesInGlobalFreshness)
  const present = new Set((judged.length > 0 ? judged : locations).map((location) => location.chip))
  return SKIPPED_REASON_PRIORITY.find((candidate) => present.has(candidate))
}

/**
 * The one sentence that explains why an update won't reach a skill. Shared by the
 * review dialog and the setup rails so the badge and the dialog can never disagree.
 *
 * The wording is deictic ("this copy") on purpose: it is only ever rendered beside the
 * location rows it describes, which is why the setup rails link into the dialog rather
 * than repeating a sentence that would have nothing to point at.
 *
 * `skillName` is only used for the no-chip case, where the fault is not a placement at
 * all but the updater's own record of this skill, and the remedy has to name it.
 */
export function skippedReason(locations: readonly SkillLocationRow[], skillName?: string): string {
  const chip = blockingChip(locations)
  switch (chip) {
    case 'newer':
      return translate(
        'auto.components.skills.SkillFreshnessRow.skippedReasonNewer',
        'This copy is a later version than the one this build of Kondex ships. Automatic updates must not replace it with an older bundled version.'
      )
    case 'unrecognized':
      return translate(
        'auto.components.skills.SkillFreshnessRow.skippedReasonUnrecognized',
        'The copy here doesn’t match the official version — it may be modified, or a different skill with the same name. Kondex left it out of the update so it won’t overwrite it. Remove it if you want Kondex to update this skill.'
      )
    case 'read-only':
      return translate(
        'auto.components.skills.SkillFreshnessRow.skippedReasonReadOnly',
        'This copy is in a read-only location, so Kondex left it out of the update. Change its permissions to let Kondex update it.'
      )
    case 'inaccessible':
      return translate(
        'auto.components.skills.SkillFreshnessRow.skippedReasonInaccessible',
        'Kondex couldn’t read this copy, so it left the skill out of the update.'
      )
    case 'in-a-repo':
      return translate(
        'auto.components.skills.SkillFreshnessRow.skippedReasonInRepo',
        'This is a project skill, not a global one — Kondex only updates your global skills, so it left this out of the update.'
      )
    case 'plugin-cache':
      return translate(
        'auto.components.skills.SkillFreshnessRow.skippedReasonPluginCache',
        'A plugin manages this skill, so Kondex left it out of the update — update the plugin instead.'
      )
    case 'external-link':
      return translate(
        'auto.components.skills.SkillFreshnessRow.skippedReasonExternalLink',
        'This copy is a shortcut pointing outside Kondex’s skill folders, so Kondex left it out of the update.'
      )
    case 'broken-link':
      return translate(
        'auto.components.skills.SkillFreshnessRow.skippedReasonBrokenLink',
        'This copy is a shortcut to something that no longer exists, so Kondex left it out — you can safely delete it.'
      )
    case 'duplicate':
      return translate(
        'auto.components.skills.SkillFreshnessRow.skippedReasonDuplicate',
        'This is a separate copy. Automatic updates require a verified Kondex installation record and unchanged files at each recorded location. Review the listed locations before replacing any files.'
      )
    case 'current':
    case undefined:
      // A missing or changed receipt cannot authorize an automatic update.
      return skillName
        ? translate(
            'kondex.nativeSkills.unverifiedReceipt',
            'An unchanged Kondex installation record could not be verified. Existing files were left untouched. Review the listed locations before trying a bundled install: {{value0}}',
            { value0: buildAgentFeatureSkillInstallCommand([skillName]) }
          )
        : translate(
            'auto.components.skills.SkillFreshnessRow.cantUpdateReason',
            'Kondex left this skill out of the update command.'
          )
  }
}
