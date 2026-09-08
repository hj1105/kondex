import {
  SUPPORTED_GLOBAL_SKILL_TOPOLOGIES,
  type SkillFreshnessInstallation
} from '../../shared/skill-freshness'

// Registration verifies receipt-owned copies; this gate also requires an outdated, safe anchor.
export function eligibleSkillUpdateNames(
  installations: readonly SkillFreshnessInstallation[],
  globallyUpdatableNames: ReadonlySet<string>
): string[] {
  const byName = new Map<string, SkillFreshnessInstallation[]>()
  for (const installation of installations) {
    const entries = byName.get(installation.name) ?? []
    entries.push(installation)
    byName.set(installation.name, entries)
  }

  const eligible: string[] = []
  for (const [, entries] of byName) {
    if (!globallyUpdatableNames.has(entries[0].name)) {
      continue
    }
    const convergent = entries.filter((entry) =>
      SUPPORTED_GLOBAL_SKILL_TOPOLOGIES.has(entry.topology)
    )
    // Why: without a convergent placement the command has no anchor, so it would
    // no-op or error against a canonical install that isn't there.
    if (convergent.length === 0) {
      continue
    }
    const hasOutdated = convergent.some((entry) => entry.status === 'outdated')
    const everyConvergentCopyIsSafeToWrite = convergent.every(
      (entry) =>
        (entry.status === 'current' || entry.status === 'outdated') &&
        Boolean(entry.resolvedPath && entry.physicalIdentity)
    )
    if (hasOutdated && everyConvergentCopyIsSafeToWrite) {
      eligible.push(entries[0].name)
    }
  }
  return eligible.sort((left, right) => left.localeCompare(right, 'en'))
}
