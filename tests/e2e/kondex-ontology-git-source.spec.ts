import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test, expect } from './helpers/orca-app'

const SIDECAR = path.resolve('vendor/kontext-brain/plugins/kontext-brain/server.mjs')

test.use({
  seedTestRepo: false,
  // The ontology CLI ships with the sidecar checkout; point the host at the real one.
  orcaAppExtraEnv: { KONDEX_KONTEXT_SIDECAR_PATH: SIDECAR }
})

function git(cwd: string, args: readonly string[]): void {
  execFileSync('git', [...args], {
    cwd,
    stdio: 'ignore',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Fixture',
      GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
      GIT_COMMITTER_NAME: 'Fixture',
      GIT_COMMITTER_EMAIL: 'fixture@example.invalid'
    }
  })
}

test('adds a repository by URL from the ontology dialog and reads its documents', async ({
  orcaPage,
  electronApp,
  registerPostElectronShutdownCleanup
}) => {
  test.skip(process.platform === 'win32', 'file:// remotes are exercised on POSIX only')
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'kondex-ontology-git-')))
  registerPostElectronShutdownCleanup(() => rm(root, { recursive: true, force: true }))
  const workspace = path.join(root, 'workspace')
  const remote = path.join(root, 'handbook.git')
  const seed = path.join(root, 'seed')
  await Promise.all([
    mkdir(workspace),
    mkdir(remote),
    mkdir(path.join(seed, 'docs'), { recursive: true })
  ])
  await writeFile(
    path.join(workspace, 'kontext.yaml'),
    [
      'llm:',
      '  traversal: {provider: none, model: none}',
      '  reasoning: {provider: none, model: none}',
      'mcp: []',
      ''
    ].join('\n')
  )
  git(remote, ['init', '--quiet', '--bare', '--initial-branch=main'])
  git(seed, ['init', '--quiet', '--initial-branch=main'])
  await writeFile(path.join(seed, 'docs', 'decisions.md'), '# Decisions\n\nRetry twice.\n')
  await writeFile(path.join(seed, 'docs', 'terms.md'), '# Terms\n\nEstablished term.\n')
  git(seed, ['add', '.'])
  git(seed, ['commit', '--quiet', '-m', 'seed'])
  git(seed, ['remote', 'add', 'origin', remote])
  git(seed, ['push', '--quiet', 'origin', 'main'])

  // Why: the checkout cache would otherwise land in the developer's real
  // ~/.cache; the app inherits this environment and hands it to the CLI.
  const cache = path.join(root, 'git-cache')
  await electronApp.evaluate(({ app }, cacheDir) => {
    process.env.KONTEXT_GIT_SOURCE_CACHE = cacheDir
    return app.getPath('userData')
  }, cache)

  await orcaPage.evaluate(async (workspacePath) => {
    const group = await window.api.projectGroups.create({ name: 'Ontology git demo' })
    await window.api.folderWorkspaces.create({
      projectGroupId: group.id,
      name: 'Handbook workspace',
      folderPath: workspacePath
    })
    await window.__store!.getState().updateSettings({ uiLanguage: 'en' })
    window.__store!.setState({ activeView: 'tasks' })
  }, workspace)

  const section = orcaPage.getByRole('region', { name: 'Ontology sources' })
  await section.scrollIntoViewIfNeeded()
  await section
    .getByLabel('Workspace holding kontext.yaml')
    .selectOption({ label: 'Handbook workspace' })
  await expect(section.getByRole('status')).toContainText(/No sources connected yet/)

  await section.getByRole('button', { name: 'Add a source' }).click()
  await section.getByRole('button', { name: 'GitHub repository' }).click()
  await expect(section.getByLabel('Transport')).toHaveValue('git')
  await section.getByLabel('Repository URL').fill(`file://${remote}`)
  await section.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(section.getByText('github_repo', { exact: true })).toBeVisible({ timeout: 30_000 })

  await section.getByRole('button', { name: 'Check connections' }).click()
  await expect(section.getByText('Every source answered.', { exact: true })).toBeVisible({
    timeout: 60_000
  })
  await expect(section.getByText('2 documents', { exact: true })).toBeVisible()
})
