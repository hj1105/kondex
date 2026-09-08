import { homedir } from 'node:os'
import { basename, isAbsolute, join } from 'node:path'
import { KONDEX_BUNDLED_SKILL_PACKAGE_ID } from './bundled-agent-skill-archive'
import { readSkillInstallReceipt, type SkillInstallReceiptV1 } from './skill-install-provenance'
import { nativeSkillInstallFilesystem } from './skill-install-filesystem'
import { runSkillCandidateTasks } from './skill-candidate-concurrency'

/** A native receipt and unchanged bytes are required; an external CLI lock grants no authority. */
export async function readBundledSkillUpdateRegistrations(
  names: readonly string[],
  args: { homeDir?: string; stateDirectory?: string }
): Promise<ReadonlyMap<string, SkillInstallReceiptV1>> {
  if (!args.stateDirectory) {
    return new Map()
  }
  const root = join(args.homeDir ?? homedir(), '.agents', 'skills')
  const stateDirectory = join(args.stateDirectory, 'skill-installs')
  const { BUNDLED_SKILL_GUIDES } = await import('../../cli/bundled-skill-guides.js')
  const allowedNames = new Set<string>(BUNDLED_SKILL_GUIDES.map((guide) => guide.name))
  const entries = await runSkillCandidateTasks(
    [...new Set(names)]
      .filter((name) => allowedNames.has(name))
      .map((name) => async () => {
        const canonicalPath = join(root, name)
        const receipt = await readSkillInstallReceipt(stateDirectory, canonicalPath)
        if (
          receipt?.packageId !== KONDEX_BUNDLED_SKILL_PACKAGE_ID ||
          receipt.scope !== 'global' ||
          receipt.wslDistro
        ) {
          return null
        }
        const observed = await nativeSkillInstallFilesystem
          .observeSkill(canonicalPath, receipt.fileModes)
          .catch(() => null)
        if (observed?.observedDigest !== receipt.packageDigest) {
          return null
        }
        for (const placement of receipt.placements) {
          if (
            !placement ||
            typeof placement.path !== 'string' ||
            !isAbsolute(placement.path) ||
            basename(placement.path) !== name
          ) {
            return null
          }
          if (placement.topology === 'provider-alias') {
            if (
              !(await nativeSkillInstallFilesystem
                .aliasTargets?.(canonicalPath, placement.path)
                .catch(() => false))
            ) {
              return null
            }
          } else if (placement.topology === 'independent-copy') {
            const copy = await nativeSkillInstallFilesystem
              .observeSkill(placement.path, receipt.fileModes)
              .catch(() => null)
            if (copy?.observedDigest !== receipt.packageDigest) {
              return null
            }
          } else if (placement.topology !== 'canonical-copy' || placement.path !== canonicalPath) {
            return null
          }
        }
        return [name, receipt] as const
      })
  )
  return new Map(
    entries.filter((entry): entry is readonly [string, SkillInstallReceiptV1] => entry !== null)
  )
}
