import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  createSkillBundleArchive,
  type CreatedSkillBundle,
  type SkillBundleSource
} from './skill-bundle-creation'

export const KONDEX_BUNDLED_SKILL_PACKAGE_ID = 'kondex-bundled-skills'

/** The callback may install locally or upload to the execution host; it owns that choice. */
export async function withBundledAgentSkillArchive<T>(
  requestedNames: readonly string[],
  consume: (bundle: CreatedSkillBundle) => Promise<T>
): Promise<T> {
  const { BUNDLED_SKILL_GUIDES } = await import('../../cli/bundled-skill-guides.js')
  const byName = new Map<string, (typeof BUNDLED_SKILL_GUIDES)[number]>(
    BUNDLED_SKILL_GUIDES.flatMap((guide) =>
      [guide.name, ...guide.aliases].map((name) => [name, guide] as const)
    )
  )
  if (requestedNames.length === 0) {
    throw new Error('bundled-skill-selection-required')
  }
  const selected = [
    ...new Set(
      requestedNames.map((name) => {
        const guide = byName.get(name)
        if (!guide) {
          throw new Error(`bundled-skill-unknown: ${name}`)
        }
        return guide
      })
    )
  ].sort((left, right) => left.name.localeCompare(right.name, 'en'))
  // Content identity also distinguishes local builds with the same app version.
  const versionId = createHash('sha256')
    .update(
      JSON.stringify(
        BUNDLED_SKILL_GUIDES.map(({ name, installMarkdown }) => [name, installMarkdown])
      )
    )
    .digest('hex')
  const staging = await mkdtemp(join(tmpdir(), 'kondex-bundled-skills-'))
  try {
    const sources: SkillBundleSource[] = []
    for (const guide of selected) {
      const sourceDirectory = join(staging, 'sources', guide.name)
      await mkdir(sourceDirectory, { recursive: true, mode: 0o700 })
      await writeFile(join(sourceDirectory, 'SKILL.md'), guide.installMarkdown, {
        flag: 'wx',
        mode: 0o600
      })
      sources.push({ id: guide.name, sourceDirectory })
    }
    const bundle = await createSkillBundleArchive({
      sources,
      archivePath: join(staging, 'bundle.tar.gz'),
      packageId: KONDEX_BUNDLED_SKILL_PACKAGE_ID,
      versionId,
      bundleName: 'kondex-bundled-skills',
      description: 'Version-matched Kondex agent discovery skills'
    })
    return await consume(bundle)
  } finally {
    await rm(staging, { recursive: true, force: true })
  }
}
