import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { BUNDLED_SKILL_GUIDES } from '../../src/cli/bundled-skill-guides'
import {
  CANONICAL_GUIDE_NAMES,
  GUIDE_ALIASES,
  STUB_TOPICS,
  assertAliasContract,
  buildArtifacts,
  frontmatterBlock,
  normalizeMarkdown,
  parseFrontmatter,
  toPosixRelativePath,
  verifyArtifacts,
  writeArtifacts
} from './generate-bundled-skill-guides.mjs'

const projectDir = path.resolve(import.meta.dirname, '..', '..')
const temporaryDirectories = []

async function createFixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'orca-bundled-skill-guides-'))
  temporaryDirectories.push(root)
  await Promise.all([
    cp(path.join(projectDir, 'skill-guides'), path.join(root, 'skill-guides'), {
      recursive: true
    }),
    cp(path.join(projectDir, 'skill-stubs'), path.join(root, 'skill-stubs'), {
      recursive: true
    }),
    cp(path.join(projectDir, 'skills'), path.join(root, 'skills'), { recursive: true }),
    mkdir(path.join(root, 'src', 'cli'), { recursive: true })
  ])
  return root
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true }))
  )
})

describe('bundled skill guide generator', () => {
  it('namespaces every installed skill while keeping old lookup aliases', () => {
    expect(CANONICAL_GUIDE_NAMES.every((name) => name.startsWith('kondex-'))).toBe(true)
    expect(GUIDE_ALIASES['kondex-computer-use']).toContain('computer-use')
    expect(GUIDE_ALIASES['kondex-orchestration']).toContain('orchestration')
    expect(GUIDE_ALIASES['kondex-cli']).toContain('orca-cli')
  })

  it('keeps every fat (non-stub) projection byte-identical to its authoritative source', async () => {
    for (const name of CANONICAL_GUIDE_NAMES) {
      if (STUB_TOPICS.includes(name)) {
        continue
      }
      const source = await readFile(path.join(projectDir, 'skill-guides', `${name}.md`))
      const projection = await readFile(path.join(projectDir, 'skills', name, 'SKILL.md'))
      expect(projection, name).toEqual(source)
    }
  })

  it('projects stub topics as hybrid discovery stubs that reuse the guide frontmatter', async () => {
    expect(STUB_TOPICS.length).toBeGreaterThan(0)
    for (const name of STUB_TOPICS) {
      const source = await readFile(path.join(projectDir, 'skill-guides', `${name}.md`), 'utf8')
      const projection = await readFile(path.join(projectDir, 'skills', name, 'SKILL.md'), 'utf8')

      // The routing frontmatter is the unchanged discovery surface.
      expect(projection.startsWith(frontmatterBlock(source, `${name}.md`))).toBe(true)
      // The stub is a thin hybrid pointer, not the full guide.
      expect(projection).not.toEqual(source)
      expect(projection.length).toBeLessThan(source.length)
      expect(projection).toContain('discovery stub')
      expect(projection).toContain(`skills get ${name}`)
    }
  })

  it('keeps pre-guide fallback useful and read-only for every converted domain', async () => {
    const expectedFallbackCommands = {
      'kondex-computer-use': [
        'KONDEX computer capabilities --json',
        'KONDEX computer list-apps --json'
      ],
      'kondex-emulator': ['KONDEX emulator list --json'],
      'kondex-emulator-android': ['KONDEX emulator devices --json'],
      'kondex-orchestration': [
        'KONDEX orchestration task-list --json',
        'KONDEX terminal list --json'
      ]
    }

    for (const [name, commands] of Object.entries(expectedFallbackCommands)) {
      const stub = await readFile(path.join(projectDir, 'skill-stubs', `${name}.md`), 'utf8')
      const fallback = stub.split('## If an older Kondex does not recognize `skills get`')[1]

      expect(fallback, name).toBeDefined()
      for (const command of commands) {
        expect(fallback, name).toContain(command)
      }
      expect(fallback, name).not.toContain('KONDEX worktree ps --json')
    }
  })

  it('embeds canonical names, discovery descriptions, Markdown, and append-only aliases', async () => {
    expect(BUNDLED_SKILL_GUIDES.map((guide) => guide.name)).toEqual(
      [...CANONICAL_GUIDE_NAMES].sort((left, right) => left.localeCompare(right, 'en'))
    )

    for (const guide of BUNDLED_SKILL_GUIDES) {
      const source = await readFile(
        path.join(projectDir, 'skill-guides', `${guide.name}.md`),
        'utf8'
      )
      const frontmatter = parseFrontmatter(source, `${guide.name}.md`)
      expect(guide.description).toBe(frontmatter.description)
      expect(guide.markdown).toBe(source)
      expect(guide.fullMarkdown).toBe(source)
      expect(guide.installMarkdown).toBe(
        await readFile(path.join(projectDir, 'skills', guide.name, 'SKILL.md'), 'utf8')
      )
      expect(guide.aliases).toEqual(GUIDE_ALIASES[guide.name])
    }
  })

  it('keeps CLI guide examples safe across shells and Linux command names', async () => {
    for (const name of [
      'kondex-cli',
      'kondex-computer-use',
      'kondex-emulator',
      'kondex-emulator-android'
    ]) {
      const source = await readFile(path.join(projectDir, 'skill-guides', `${name}.md`), 'utf8')

      expect(source).toContain('KONDEX_CLI_COMMAND')
      expect(source).toContain('ORCA_CLI_COMMAND')
      expect(source.indexOf('KONDEX_CLI_COMMAND')).toBeLessThan(source.indexOf('ORCA_CLI_COMMAND'))
      expect(source).toContain('kondex-dev')
      expect(source).not.toContain('GNOME')
      expect(source).toContain('PowerShell')
      expect(source).toContain('cmd.exe')
      expect(source).toMatch(/^KONDEX .+--json$/mu)
      // Why: bare command lines can launch GNOME Orca, while shell variables make
      // the same guide unusable from PowerShell and cmd.exe.
      expect(source).not.toMatch(/^orca /mu)
      expect(source).not.toMatch(/\$(?:ORCA|KONDEX)(?:_|\b)/u)
    }
  })

  it('keeps discovery stubs scoped to the configured Kondex session', async () => {
    for (const name of STUB_TOPICS) {
      const source = await readFile(path.join(projectDir, 'skill-stubs', `${name}.md`), 'utf8')
      expect(source.indexOf('KONDEX_CLI_COMMAND')).toBeGreaterThan(-1)
      expect(source.indexOf('KONDEX_CLI_COMMAND')).toBeLessThan(source.indexOf('ORCA_CLI_COMMAND'))
      expect(source).toContain('belongs to Kondex')
      expect(source).toContain('legacy `orca` bridge on an SSH host')
      expect(source).not.toContain('GNOME')
    }
  })

  it('builds deterministic artifacts and verifies the checked-in outputs', async () => {
    const first = await buildArtifacts(projectDir)
    const second = await buildArtifacts(projectDir)

    expect(second).toEqual(first)
    await expect(verifyArtifacts(first, projectDir)).resolves.toBeUndefined()
  })

  it('generates platform-identical output from CRLF guide sources', async () => {
    const expected = await buildArtifacts(projectDir)
    const root = await createFixture()
    for (const name of CANONICAL_GUIDE_NAMES) {
      const sourcePath = path.join(root, 'skill-guides', `${name}.md`)
      const source = await readFile(sourcePath, 'utf8')
      await writeFile(sourcePath, source.replaceAll('\n', '\r\n'))
    }
    for (const name of STUB_TOPICS) {
      const stubPath = path.join(root, 'skill-stubs', `${name}.md`)
      const stubSource = await readFile(stubPath, 'utf8')
      await writeFile(stubPath, stubSource.replaceAll('\n', '\r\n'))
    }

    const actual = await buildArtifacts(root)
    expect(actual.map((artifact) => artifact.content)).toEqual(
      expected.map((artifact) => artifact.content)
    )
  })

  it('pins guide sources, projections, and embedded output to LF in Git', async () => {
    const attributes = await readFile(path.join(projectDir, '.gitattributes'), 'utf8')
    expect(normalizeMarkdown(attributes)).toContain('/skill-guides/*.md text eol=lf\n')
    expect(normalizeMarkdown(attributes)).toContain('/skill-stubs/*.md text eol=lf\n')
    expect(normalizeMarkdown(attributes)).toContain('/skills/*/SKILL.md text eol=lf\n')
    expect(normalizeMarkdown(attributes)).toContain(
      '/src/cli/bundled-skill-guides.ts text eol=lf\n'
    )
  })

  it('reports stale outputs and write mode repairs all projections', async () => {
    const root = await createFixture()
    const artifacts = await buildArtifacts(root)

    await expect(verifyArtifacts(artifacts, root)).rejects.toThrow(
      'src/cli/bundled-skill-guides.ts'
    )
    await writeArtifacts(artifacts)
    await expect(verifyArtifacts(artifacts, root)).resolves.toBeUndefined()

    await writeFile(path.join(root, 'skills', 'kondex-computer-use', 'SKILL.md'), 'stale\n')
    await expect(verifyArtifacts(artifacts, root)).rejects.toThrow(
      'skills/kondex-computer-use/SKILL.md'
    )
  })

  // Why: the stale-artifact assertions above only hit the Windows separator when the host is
  // Windows; injecting path.win32 makes the Linux/macOS shards catch the regression too.
  it('formats contributor-facing paths with forward slashes on every platform', () => {
    expect(
      toPosixRelativePath('C:\\repo', 'C:\\repo\\src\\cli\\bundled-skill-guides.ts', path.win32)
    ).toBe('src/cli/bundled-skill-guides.ts')
    expect(
      toPosixRelativePath('C:\\repo', 'C:\\repo\\skills\\kondex-computer-use\\SKILL.md', path.win32)
    ).toBe('skills/kondex-computer-use/SKILL.md')
    expect(
      toPosixRelativePath('/repo', '/repo/skills/kondex-computer-use/SKILL.md', path.posix)
    ).toBe('skills/kondex-computer-use/SKILL.md')
  })

  it('rejects mismatched source names and ambiguous aliases', async () => {
    const root = await createFixture()
    await writeFile(
      path.join(root, 'skill-guides', 'kondex-computer-use.md'),
      '---\nname: wrong\ndescription: present\n---\n'
    )
    await expect(buildArtifacts(root)).rejects.toThrow('declares mismatched name wrong')

    expect(() =>
      assertAliasContract([
        { name: 'first', aliases: ['legacy'] },
        { name: 'second', aliases: ['legacy'] }
      ])
    ).toThrow('assigned more than once')
    expect(() =>
      assertAliasContract([
        { name: 'first', aliases: ['second'] },
        { name: 'second', aliases: [] }
      ])
    ).toThrow('collides with canonical name')
  })
})
