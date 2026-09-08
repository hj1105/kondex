import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeSkillInstallReceipt } from './skill-install-provenance'
import { nativeSkillInstallFilesystem } from './skill-install-filesystem'
import { KONDEX_BUNDLED_SKILL_PACKAGE_ID } from './bundled-agent-skill-archive'
import type {
  SkillBundleFileIdentity,
  SkillCurrentBundleEntry,
  SkillKnownSnapshot
} from '../../shared/skill-freshness'
import { describeObservedSkillFile, skillPackageDigest } from './skill-package-identity'

export const temporaryDirectories: string[] = []

export function snapshot(releaseRevision: number, markdown: string): SkillKnownSnapshot {
  const observed = describeObservedSkillFile('SKILL.md', Buffer.from(markdown), false)
  const file: SkillBundleFileIdentity = {
    path: observed.path,
    size: observed.size,
    executable: observed.executable,
    classification: observed.classification,
    exactSha256: observed.exactSha256,
    textNormalizedSha256: observed.textNormalizedSha256,
    identitySha256: observed.identitySha256
  }
  return {
    releaseRevision,
    packageDigest: skillPackageDigest([file]),
    gitTreeSha: releaseRevision.toString(16).padStart(40, '0'),
    files: [file]
  }
}

export async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'orca-skill-inventory-'))
  temporaryDirectories.push(root)
  const homeDir = join(root, 'home')
  const resourceRoot = join(root, 'resources')
  const skillResourceRoot = join(resourceRoot, 'skills')
  await mkdir(skillResourceRoot, { recursive: true })

  const oldMarkdown = '---\nname: kondex-cli\ndescription: Old official guide.\n---\n\n# Old\n'
  const currentMarkdown =
    '---\nname: kondex-cli\ndescription: Current official guide.\n---\n\n# Current\n'
  const newerMarkdown =
    '---\nname: kondex-cli\ndescription: Newer official guide.\n---\n\n# Newer\n'
  const snapshots = [
    snapshot(1, oldMarkdown),
    snapshot(2, currentMarkdown),
    snapshot(3, newerMarkdown)
  ]
  const current: SkillCurrentBundleEntry = {
    name: 'kondex-cli',
    sourcePath: 'skills/kondex-cli',
    ...snapshots[1]
  }
  await Promise.all([
    mkdir(join(homeDir, '.agents'), { recursive: true }).then(() =>
      writeFile(
        join(homeDir, '.agents', '.skill-lock.json'),
        `${JSON.stringify({
          version: 3,
          skills: {
            'kondex-cli': {
              skillFolderHash: 'tracked-old-hash',
              skillPath: 'skills/kondex-cli/SKILL.md',
              source: 'stablyai/orca'
            }
          }
        })}\n`
      )
    ),
    writeFile(
      join(skillResourceRoot, 'current-manifest.json'),
      `${JSON.stringify({ schemaVersion: 2, skills: [current] }, null, 2)}\n`
    ),
    writeFile(
      join(skillResourceRoot, 'snapshot-registry.json'),
      `${JSON.stringify({ schemaVersion: 1, skills: { 'kondex-cli': snapshots } }, null, 2)}\n`
    ),
    writeFile(
      join(skillResourceRoot, 'release-mapping.json'),
      `${JSON.stringify(
        {
          schemaVersion: 1,
          releases: [
            { appVersion: '1.0.0', skills: { 'kondex-cli': 1 } },
            { appVersion: '2.0.0', skills: { 'kondex-cli': 2 } },
            { appVersion: '3.0.0', skills: { 'kondex-cli': 3 } }
          ]
        },
        null,
        2
      )}\n`
    )
  ])

  const writeSkill = async (rootPath: string, markdown: string): Promise<string> => {
    const directory = join(rootPath, 'kondex-cli')
    await mkdir(directory, { recursive: true })
    await writeFile(join(directory, 'SKILL.md'), markdown)
    if (rootPath === join(homeDir, '.agents', 'skills')) {
      const observed = await nativeSkillInstallFilesystem.observeSkill(directory)
      await writeSkillInstallReceipt(join(root, 'state', 'skill-installs'), {
        schemaVersion: 1,
        packageId: KONDEX_BUNDLED_SKILL_PACKAGE_ID,
        versionId: 'fixture',
        packageDigest: observed.observedDigest,
        archiveSha256: 'fixture',
        scope: 'global',
        destinationIdentity: 'fixture',
        canonicalPath: directory,
        placements: [],
        providers: [],
        installedAt: new Date(0).toISOString(),
        hostIdentity: 'local'
      })
    }
    return directory
  }
  return {
    root,
    homeDir,
    stateDirectory: join(root, 'state'),
    resourceRoot,
    oldMarkdown,
    currentMarkdown,
    newerMarkdown,
    writeSkill
  }
}

export async function writeLegacySkillLockHash(
  homeDir: string,
  skillFolderHash: string
): Promise<void> {
  await writeFile(
    join(homeDir, '.agents', '.skill-lock.json'),
    `${JSON.stringify({
      version: 3,
      skills: {
        'kondex-cli': {
          skillFolderHash,
          skillPath: 'skills/kondex-cli/SKILL.md',
          source: 'stablyai/orca'
        }
      }
    })}\n`
  )
}
