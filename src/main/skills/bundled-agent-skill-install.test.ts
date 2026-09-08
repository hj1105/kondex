import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  mutateBundledAgentSkills,
  type BundledAgentSkillInstallInput
} from './bundled-agent-skill-install'
import { createSkillBundleArchive } from './skill-bundle-creation'
import { installSkillBundle } from './skill-bundle-install-service'
import { KONDEX_BUNDLED_SKILL_PACKAGE_ID } from './bundled-agent-skill-archive'
import { readBundledSkillUpdateRegistrations } from './bundled-skill-update-registration'

const roots: string[] = []
async function fixture(): Promise<BundledAgentSkillInstallInput> {
  const root = await mkdtemp(join(tmpdir(), 'kondex-native-skills-test-'))
  roots.push(root)
  return {
    verb: 'install',
    skillNames: ['kondex-cli'],
    scope: 'global',
    homeDirectory: join(root, 'home'),
    workspaceDirectory: join(root, 'workspace'),
    stateDirectory: join(root, 'state'),
    providers: ['codex']
  }
}
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('native bundled skill mutations', () => {
  it('registers only unchanged receipt-owned bundles and never trusts an external CLI lock', async () => {
    const input = await fixture()
    await mutateBundledAgentSkills(input)
    const args = { homeDir: input.homeDirectory, stateDirectory: input.stateDirectory }
    expect([
      ...(await readBundledSkillUpdateRegistrations(['kondex-cli', 'orca-cli'], args)).keys()
    ]).toEqual(['kondex-cli'])
    const skillFile = join(input.homeDirectory, '.agents', 'skills', 'kondex-cli', 'SKILL.md')
    await writeFile(skillFile, `${await readFile(skillFile, 'utf8')}\nUser edits.\n`)
    await writeFile(
      join(input.homeDirectory, '.agents', '.skill-lock.json'),
      JSON.stringify({
        version: 3,
        skills: {
          'kondex-cli': {
            skillFolderHash: 'claimed',
            skillPath: 'skills/kondex-cli',
            source: 'external'
          }
        }
      })
    )
    expect((await readBundledSkillUpdateRegistrations(['kondex-cli'], args)).size).toBe(0)
    expect(
      (await readBundledSkillUpdateRegistrations(['kondex-cli'], { homeDir: input.homeDirectory }))
        .size
    ).toBe(0)
  })
  it('refuses an already-aborted mutation before creating install state', async () => {
    const input = await fixture()
    const controller = new AbortController()
    controller.abort()
    await expect(
      mutateBundledAgentSkills({ ...input, signal: controller.signal })
    ).rejects.toThrow()
    await expect(readdir(input.homeDirectory)).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(readdir(input.stateDirectory)).rejects.toMatchObject({ code: 'ENOENT' })
  })
  it('updates a clean older managed version to the current embedded stub', async () => {
    const input = await fixture()
    const sourceDirectory = join(input.workspaceDirectory, 'previous-version')
    await mkdir(sourceDirectory, { recursive: true })
    await writeFile(
      join(sourceDirectory, 'SKILL.md'),
      '---\nname: kondex-cli\ndescription: Earlier Kondex version\n---\nOld guide\n'
    )
    const old = await createSkillBundleArchive({
      sources: [{ sourceDirectory }],
      archivePath: join(input.workspaceDirectory, 'previous.tar.gz'),
      packageId: KONDEX_BUNDLED_SKILL_PACKAGE_ID,
      versionId: 'previous',
      bundleName: 'kondex-bundled-skills'
    })
    expect(
      (
        await installSkillBundle({
          operationId: 'seed-previous-version',
          archivePath: old.archivePath,
          packageId: old.manifest.packageId,
          versionId: old.manifest.versionId,
          bundleDigest: old.manifest.bundleDigest,
          selectedSkillIds: ['kondex-cli'],
          expectedArchiveSha256: old.archiveSha256,
          scope: input.scope,
          homeDirectory: input.homeDirectory,
          workspaceDirectory: input.workspaceDirectory,
          orcaStateDirectory: input.stateDirectory,
          detectedProviders: ['codex'],
          destinationIdentity: `global:${input.homeDirectory}`,
          hostIdentity: 'local'
        })
      ).status
    ).toBe('complete')
    const result = await mutateBundledAgentSkills({ ...input, verb: 'update', providers: [] })
    expect(result.status).toBe('complete')
    expect(result.skills[0].status).toBe('updated')
    await expect(
      readFile(join(input.homeDirectory, '.agents', 'skills', 'kondex-cli', 'SKILL.md'), 'utf8')
    ).resolves.toContain('discovery stub')
  })

  it('updates only existing Kondex-managed installations, retaining original targets', async () => {
    const input = await fixture()
    expect((await mutateBundledAgentSkills(input)).skills[0].status).toBe('installed')
    const result = await mutateBundledAgentSkills({ ...input, verb: 'update', providers: [] })
    expect(result.status).toBe('complete')
    expect(result.skills[0].status).toBe('unchanged')
    expect(result.skippedSkills).toEqual([])
    await expect(readdir(input.homeDirectory)).resolves.toEqual(['.agents'])
  })

  it('does not install missing skills during update', async () => {
    const input = await fixture()
    expect(await mutateBundledAgentSkills({ ...input, verb: 'update', providers: [] })).toEqual({
      status: 'complete',
      skills: [],
      skippedSkills: ['kondex-cli']
    })
    await expect(readdir(input.homeDirectory)).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(readdir(input.stateDirectory)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('keeps an unmanaged name collision untouched during update', async () => {
    const input = await fixture()
    const path = join(input.homeDirectory, '.agents', 'skills', 'kondex-cli', 'SKILL.md')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, 'User-owned skill\n')
    const result = await mutateBundledAgentSkills({ ...input, verb: 'update', providers: [] })
    expect(result.skippedSkills).toEqual(['kondex-cli'])
    await expect(readFile(path, 'utf8')).resolves.toBe('User-owned skill\n')
  })

  it('keeps local edits and returns partial rather than discarding them', async () => {
    const input = await fixture()
    await mutateBundledAgentSkills(input)
    const path = join(input.homeDirectory, '.agents', 'skills', 'kondex-cli', 'SKILL.md')
    const edited = `${await readFile(path, 'utf8')}\nLocal edit\n`
    await writeFile(path, edited)
    const result = await mutateBundledAgentSkills({ ...input, verb: 'update', providers: [] })
    expect(result.status).toBe('partial')
    expect(result.skills[0].status).toBe('kept-local')
    await expect(readFile(path, 'utf8')).resolves.toBe(edited)
  })

  it('installs in a plain folder without requiring Git or modifying the global home', async () => {
    const input = { ...(await fixture()), scope: 'workspace' as const, providers: ['claude'] }
    const result = await mutateBundledAgentSkills(input)
    expect(result.status).toBe('complete')
    await expect(
      readFile(
        join(input.workspaceDirectory, '.claude', 'skills', 'kondex-cli', 'SKILL.md'),
        'utf8'
      )
    ).resolves.toContain('discovery stub')
    await expect(readdir(input.homeDirectory)).rejects.toMatchObject({ code: 'ENOENT' })
    const other = await mutateBundledAgentSkills({
      ...input,
      verb: 'update',
      workspaceDirectory: `${input.workspaceDirectory}-other`,
      providers: []
    })
    expect(other.skippedSkills).toEqual(['kondex-cli'])
  })

  it('respects a configured Claude skill root', async () => {
    const input = await fixture()
    const claude = join(input.homeDirectory, 'custom-claude', 'skills')
    const result = await mutateBundledAgentSkills({
      ...input,
      providers: ['claude'],
      providerRootOverrides: { claude }
    })
    expect(result.status).toBe('complete')
    await expect(readFile(join(claude, 'kondex-cli', 'SKILL.md'), 'utf8')).resolves.toContain(
      'discovery stub'
    )
    await expect(readdir(join(input.homeDirectory, '.claude'))).rejects.toMatchObject({
      code: 'ENOENT'
    })
    const changedRoot = join(input.homeDirectory, 'new-claude', 'skills')
    const update = await mutateBundledAgentSkills({
      ...input,
      verb: 'update',
      providers: [],
      providerRootOverrides: { claude: changedRoot }
    })
    expect(update.status).toBe('complete')
    await expect(readFile(join(claude, 'kondex-cli', 'SKILL.md'), 'utf8')).resolves.toContain(
      'discovery stub'
    )
    await expect(readdir(changedRoot)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects unsupported targets before any destination write', async () => {
    const input = await fixture()
    await expect(mutateBundledAgentSkills({ ...input, providers: ['gemini'] })).rejects.toThrow(
      'bundled-skill-provider-invalid'
    )
    await expect(readdir(input.homeDirectory)).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
