import { randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BUNDLED_SKILL_GUIDES } from '../../cli/bundled-skill-guides'
import {
  KONDEX_BUNDLED_SKILL_PACKAGE_ID,
  withBundledAgentSkillArchive
} from './bundled-agent-skill-archive'
import type { CreatedSkillBundle } from './skill-bundle-creation'
import { installSkillBundle } from './skill-bundle-install-service'
import { listManagedSkillInstalls } from './skill-install-provenance'

const roots: string[] = []
async function fixtureRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'kondex-bundled-skill-test-'))
  roots.push(root)
  return root
}

function install(root: string, bundle: CreatedSkillBundle) {
  return installSkillBundle({
    operationId: randomUUID(),
    archivePath: bundle.archivePath,
    packageId: bundle.manifest.packageId,
    versionId: bundle.manifest.versionId,
    bundleDigest: bundle.manifest.bundleDigest,
    selectedSkillIds: bundle.manifest.skills.map((skill) => skill.id),
    expectedArchiveSha256: bundle.archiveSha256,
    scope: 'global',
    homeDirectory: join(root, 'home'),
    orcaStateDirectory: join(root, 'state'),
    detectedProviders: ['codex', 'claude'],
    destinationIdentity: 'local-global',
    hostIdentity: 'fixture-host'
  })
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('bundled Kondex skill archive', () => {
  it.each(
    [[], ['unknown'], ['../../outside'], ['kondex-cli', '--all']].map((names) => ({ names }))
  )('rejects invalid selection $names before invoking its consumer', async ({ names }) => {
    const consume = vi.fn()
    await expect(withBundledAgentSkillArchive(names, consume)).rejects.toThrow(/bundled-skill-/)
    expect(consume).not.toHaveBeenCalled()
  })

  it('canonicalizes legacy aliases without installing under an upstream name', async () => {
    const result = await withBundledAgentSkillArchive(
      ['orca-cli', 'kondex-cli', 'orca-emulator'],
      async ({ manifest }) => manifest
    )
    expect(result.packageId).toBe(KONDEX_BUNDLED_SKILL_PACKAGE_ID)
    expect(result.skills.map(({ name }) => name)).toEqual(['kondex-cli', 'kondex-emulator'])
    expect(result.versionId).toMatch(/^[a-f0-9]{64}$/)
  })

  it('keeps content identity stable across selection order and repeated creation', async () => {
    const first = await withBundledAgentSkillArchive(
      ['kondex-cli', 'orchestration'],
      async (b) => b.manifest
    )
    const second = await withBundledAgentSkillArchive(
      ['orchestration', 'kondex-cli'],
      async (b) => b.manifest
    )
    const subset = await withBundledAgentSkillArchive(['kondex-cli'], async (b) => b.manifest)
    expect(first.bundleDigest).toBe(second.bundleDigest)
    expect(first.versionId).toBe(second.versionId)
    expect(first.versionId).toBe(subset.versionId)
  })

  it.each([false, true])(
    'removes temporary package bytes after consumer failure=%s',
    async (fails) => {
      let archivePath = ''
      const operation = withBundledAgentSkillArchive(['kondex-cli'], async (bundle) => {
        archivePath = bundle.archivePath
        expect((await stat(archivePath)).size).toBeGreaterThan(0)
        if (fails) {
          throw new Error('upload failed')
        }
        return 'uploaded'
      })
      await (fails
        ? expect(operation).rejects.toThrow('upload failed')
        : expect(operation).resolves.toBe('uploaded'))
      await expect(stat(dirname(archivePath))).rejects.toMatchObject({ code: 'ENOENT' })
    }
  )

  it.each([
    ['orca-cli', 'kondex-cli'],
    ['computer-use', 'kondex-computer-use'],
    ['orchestration', 'kondex-orchestration']
  ])('installs %s under %s without touching its existing alias directory', async (alias, name) => {
    const root = await fixtureRoot()
    const legacy = join(root, 'home', '.agents', 'skills', alias, 'SKILL.md')
    await mkdir(dirname(legacy), { recursive: true })
    await writeFile(legacy, 'Existing Orca skill\n')
    const result = await withBundledAgentSkillArchive([alias, name], (bundle) =>
      install(root, bundle)
    )
    expect(result.status).toBe('complete')
    expect(result.skills[0].status).toBe('installed')
    expect(result.skills).toHaveLength(1)
    const embedded = BUNDLED_SKILL_GUIDES.find((guide) => guide.name === name)!.installMarkdown
    expect(embedded).toContain('discovery stub')
    for (const provider of ['.agents', '.claude']) {
      await expect(
        readFile(join(root, 'home', provider, 'skills', name, 'SKILL.md'), 'utf8')
      ).resolves.toBe(embedded)
    }
    await expect(readFile(legacy, 'utf8')).resolves.toBe('Existing Orca skill\n')
    await expect(readdir(join(root, 'home'))).resolves.toEqual(['.agents', '.claude'])
    await expect(listManagedSkillInstalls(join(root, 'state', 'skill-installs'))).resolves.toEqual([
      expect.objectContaining({ name, packageId: KONDEX_BUNDLED_SKILL_PACKAGE_ID })
    ])
  })

  it('keeps an unowned skill even when its name is Kondex-prefixed', async () => {
    const root = await fixtureRoot()
    const path = join(root, 'home', '.agents', 'skills', 'kondex-orchestration', 'SKILL.md')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(
      path,
      '---\nname: kondex-orchestration\ndescription: User owned\n---\nDo not replace\n'
    )
    const before = await readFile(path, 'utf8')
    const result = await withBundledAgentSkillArchive(['orchestration'], (bundle) =>
      install(root, bundle)
    )
    expect(result.status).toBe('partial')
    expect(result.skills[0]).toMatchObject({ status: 'kept-local', conflict: { kind: 'unowned' } })
    await expect(readFile(path, 'utf8')).resolves.toBe(before)
    await expect(listManagedSkillInstalls(join(root, 'state', 'skill-installs'))).resolves.toEqual(
      []
    )
  })

  it('is idempotent and preserves edits to a previously managed Kondex skill', async () => {
    const root = await fixtureRoot()
    await withBundledAgentSkillArchive(['kondex-cli'], (bundle) => install(root, bundle))
    const repeated = await withBundledAgentSkillArchive(['kondex-cli'], (bundle) =>
      install(root, bundle)
    )
    expect(repeated.skills[0].status).toBe('unchanged')
    const path = join(root, 'home', '.agents', 'skills', 'kondex-cli', 'SKILL.md')
    const edited = `${await readFile(path, 'utf8')}\nUser customization\n`
    await writeFile(path, edited)
    const result = await withBundledAgentSkillArchive(['kondex-cli'], (bundle) =>
      install(root, bundle)
    )
    expect(result.skills[0]).toMatchObject({ status: 'kept-local', conflict: { kind: 'modified' } })
    await expect(readFile(path, 'utf8')).resolves.toBe(edited)
  })
})
