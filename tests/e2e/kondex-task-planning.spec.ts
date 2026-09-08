import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { runProcess } from '../../src/shared/child-process/run-process'
import { test, expect } from './helpers/orca-app'

test.use({
  seedTestRepo: false,
  orcaAppExtraEnv: {
    KONDEX_KONTEXT_SIDECAR_PATH: path.resolve('tests/e2e/fixtures/kontext-planning-sidecar.mjs'),
    KONDEX_PLAN_FIXTURE_NODE: process.execPath
  }
})

const planningCases = (['codex', 'claude'] as const).flatMap((provider) =>
  (['committed', 'dirty', 'unborn', 'folder'] as const).map((workspaceKind) => ({
    provider,
    workspaceKind
  }))
)
for (const { provider, workspaceKind } of planningCases) {
  test(`generates and approves a ${workspaceKind} Task through GUI and MCP with an offline ${provider} planner fixture`, async ({
    orcaPage,
    electronApp,
    registerPostElectronShutdownCleanup
  }, testInfo) => {
    test.skip(process.platform === 'win32', 'The fake CLI shebang fixture is POSIX-only')
    const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'kondex-plan-e2e-')))
    registerPostElectronShutdownCleanup(() => rm(root, { recursive: true, force: true }))
    const workspace = path.join(root, 'code')
    const home = path.join(root, 'home')
    const templates = path.join(root, 'templates')
    await Promise.all([workspace, home, templates].map((dir) => mkdir(dir)))
    const git = async (args: string[]) => {
      const result = await runProcess({
        program: '/usr/bin/git',
        args,
        cwd: workspace,
        env: { PATH: '/usr/bin', HOME: home, XDG_CONFIG_HOME: home, GIT_CONFIG_NOSYSTEM: '1' }
      })
      expect(result.code, result.stderr).toBe(0)
    }
    if (workspaceKind !== 'folder') {
      await git(['init', '--quiet', `--template=${templates}`])
    }
    await writeFile(path.join(workspace, 'index.ts'), 'export function total() { return 1; }\n')
    if (workspaceKind === 'committed' || workspaceKind === 'dirty') {
      await git(['add', '--', 'index.ts'])
      await git([
        '-c',
        'user.name=Fixture',
        '-c',
        'user.email=fixture@example.invalid',
        '-c',
        'commit.gpgsign=false',
        'commit',
        '--no-verify',
        '--quiet',
        '-m',
        'fixture'
      ])
    }
    const workingValue = workspaceKind === 'committed' ? 1 : 7
    const workingCode = `export function total() { return ${workingValue}; }\n`
    await writeFile(path.join(workspace, 'index.ts'), workingCode)
    await writeFile(path.join(root, 'notes.md'), '# Terms\nEstablished total term\n')
    const selectors = await orcaPage.evaluate(
      async ({ root, workspace }) => {
        const group = await window.api.projectGroups.create({ name: 'Planning fixture' })
        const source = await window.api.folderWorkspaces.create({
          projectGroupId: group.id,
          name: 'Source fixture',
          folderPath: root
        })
        const code = await window.api.folderWorkspaces.create({
          projectGroupId: group.id,
          name: 'Code fixture',
          folderPath: workspace
        })
        await window.__store!.getState().updateSettings({ uiLanguage: 'en' })
        window.__store!.setState({ activeView: 'tasks' })
        return { source: `folder:${source.id}`, code: `folder:${code.id}` }
      },
      { root, workspace }
    )
    await orcaPage.getByLabel('Source workspace path or selector').fill(selectors.source)
    await orcaPage.getByLabel('Workspace-relative Markdown path').fill('notes.md')
    await orcaPage.getByRole('button', { name: 'Register / refresh source' }).click()
    await expect(orcaPage.getByText('Source snapshot registered', { exact: true })).toBeVisible()
    const resourceId = await orcaPage.getByLabel('Registered Resource ID').inputValue()
    await orcaPage.getByRole('button', { name: 'Read saved permissions' }).click()
    await orcaPage
      .getByRole('checkbox', { name: provider === 'codex' ? 'Codex' : 'Claude', exact: true })
      .click()
    await orcaPage.getByRole('checkbox', { name: /I confirm these model permissions/ }).click()
    await orcaPage.getByRole('button', { name: 'Save model permissions' }).click()
    await expect(
      orcaPage.getByText(`Saved model permissions: ${provider}`, { exact: true })
    ).toBeVisible()
    await orcaPage
      .getByLabel('What should change?')
      .fill(`E2E only: implement total; expected working value ${workingValue}`)
    await orcaPage.getByLabel('Coding workspace path or selector').fill(selectors.code)
    if (provider === 'claude') {
      await orcaPage.getByRole('combobox', { name: 'Planning runtime' }).click()
      await orcaPage.getByRole('option', { name: 'Claude', exact: true }).click()
    }
    await orcaPage.getByRole('combobox', { name: 'Browse registered sources' }).click()
    await orcaPage.getByPlaceholder('Search loaded sources…').fill('notes.md')
    const sourceOption = orcaPage.getByRole('option', { name: /notes\.md/ })
    await expect(sourceOption).toBeVisible()
    await expect(sourceOption).toContainText(`Saved model permissions: ${provider}`)
    await sourceOption.click()
    await expect(sourceOption.getByText('notes.md', { exact: true })).toBeInViewport({ ratio: 1 })
    await expect(orcaPage.getByRole('button', { name: 'Reload source list' })).toBeInViewport({
      ratio: 1
    })
    await orcaPage
      .getByText('Saved metadata only, not a live origin check.', { exact: false })
      .locator('..')
      .screenshot({ path: testInfo.outputPath('kondex-source-picker.png') })
    await orcaPage.evaluate(async () =>
      window.__store!.getState().updateSettings({ uiLanguage: 'ko' })
    )
    await expect(orcaPage.getByRole('button', { name: '자료 목록 다시 읽기' })).toBeInViewport({
      ratio: 1
    })
    await orcaPage
      .getByText('저장된 메타데이터이며 실시간 원본 확인은 아닙니다.', { exact: false })
      .locator('..')
      .screenshot({ path: testInfo.outputPath('kondex-source-picker-ko.png') })
    await orcaPage.evaluate(async () =>
      window.__store!.getState().updateSettings({ uiLanguage: 'en' })
    )
    await orcaPage.keyboard.press('Escape')
    await expect(orcaPage.getByLabel('Required source Resource IDs (one per line)')).toHaveValue(
      resourceId
    )
    await expect(orcaPage.getByRole('button', { name: 'Generate plan' })).toBeDisabled()
    await orcaPage.getByRole('checkbox', { name: /Use my selected subscription/ }).click()
    await orcaPage.getByRole('button', { name: 'Generate plan' }).click()
    await expect(orcaPage.getByText('Awaiting your review', { exact: true })).toBeVisible()
    await expect(
      orcaPage.getByText('Compute total using the established term', { exact: true })
    ).toBeVisible()
    await expect(orcaPage.getByRole('button', { name: 'Approve and register Task' })).toBeDisabled()
    await orcaPage
      .getByTestId('kontext-plan-review')
      .screenshot({ path: testInfo.outputPath('kondex-plan-review.png') })
    if (workspaceKind === 'folder') {
      await orcaPage.getByRole('checkbox', { name: /I approve this exact task/ }).click()
      await orcaPage.locator('summary').filter({ hasText: 'Request a revised draft' }).click()
      await orcaPage
        .getByLabel('What should this draft change?')
        .fill('Preserve zero and rounding boundaries')
      await expect(orcaPage.getByRole('button', { name: 'Request a revised draft' })).toBeDisabled()
      await orcaPage.getByRole('checkbox', { name: /Use the parent draft/ }).click()
      await orcaPage
        .locator('details')
        .filter({
          has: orcaPage.getByLabel('What should this draft change?')
        })
        .screenshot({ path: testInfo.outputPath('kondex-plan-feedback.png') })
      await orcaPage.getByRole('button', { name: 'Request a revised draft' }).click()
      await expect(orcaPage.getByText('Awaiting your review', { exact: true })).toBeVisible()
      await expect(orcaPage.getByTestId('kontext-plan-review')).toContainText(
        'Preserve zero and rounding boundaries'
      )
      await expect(
        orcaPage.getByRole('button', { name: 'Approve and register Task' })
      ).toBeDisabled()
      await expect(
        orcaPage.getByText('Parent draft and exact digest', { exact: true })
      ).toBeVisible()
      await orcaPage.getByRole('combobox', { name: 'Saved planning requests' }).click()
      await expect(orcaPage.getByRole('option')).toHaveCount(2)
      await orcaPage.keyboard.press('Escape')
      await orcaPage.evaluate(async () =>
        window.__store!.getState().updateSettings({ uiLanguage: 'ko' })
      )
      await expect(
        orcaPage.getByText('원본 초안과 정확한 다이제스트', { exact: true })
      ).toBeVisible()
      await orcaPage
        .getByRole('region', { name: '새 작업 계획' })
        .screenshot({ path: testInfo.outputPath('kondex-plan-refinement-ko.png') })
      await orcaPage.evaluate(async () =>
        window.__store!.getState().updateSettings({ uiLanguage: 'en' })
      )
    }
    await orcaPage.reload()
    await orcaPage.waitForFunction(() => Boolean(window.__store))
    await orcaPage.evaluate(() => window.__store!.setState({ activeView: 'tasks' }))
    await orcaPage.getByRole('button', { name: 'Read plan status' }).click()
    await expect(orcaPage.getByText('Awaiting your review', { exact: true })).toBeVisible()
    if (workspaceKind === 'folder') {
      await expect(orcaPage.getByTestId('kontext-plan-review')).toContainText(
        'Preserve zero and rounding boundaries'
      )
      const userData = await electronApp.evaluate(({ app }) => app.getPath('userData'))
      const invocations = (
        await readFile(path.join(userData, 'kontext', 'planning-fixture-invocations.jsonl'), 'utf8')
      )
        .trim()
        .split('\n')
      expect(invocations.map((line) => JSON.parse(line))).toEqual([{ provider }, { provider }])
    }
    await orcaPage.getByRole('checkbox', { name: /I approve this exact task/ }).click()
    await orcaPage.getByRole('button', { name: 'Approve and register Task' }).click()
    await expect(
      orcaPage.getByText('Task registered; implementation has not started', { exact: true })
    ).toBeVisible()
    await expect(orcaPage.getByLabel('Task ID', { exact: true })).toHaveValue(/^host-task:/)
    await expect(orcaPage.getByLabel('Worktree path or selector', { exact: true })).toHaveValue(
      selectors.code
    )
    await expect(orcaPage.getByRole('button', { name: 'Start schedule' })).toBeDisabled()
    expect(await readFile(path.join(workspace, 'index.ts'), 'utf8')).toBe(workingCode)
    if (workspaceKind === 'folder') {
      await expect(readFile(path.join(workspace, '.git', 'HEAD'))).rejects.toMatchObject({
        code: 'ENOENT'
      })
    }
    await orcaPage.evaluate(async () =>
      window.__store!.getState().updateSettings({ uiLanguage: 'ko' })
    )
    await expect(
      orcaPage.getByText('작업 등록 완료 · 구현은 시작하지 않음', { exact: true })
    ).toBeVisible()
    await orcaPage
      .getByTestId('kontext-plan-review')
      .screenshot({ path: testInfo.outputPath('kondex-plan-review-ko.png') })
  })
}
