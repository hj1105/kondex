import { createHash } from 'node:crypto'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test, expect } from './helpers/orca-app'

test.use({
  seedTestRepo: false,
  orcaAppExtraEnv: {
    KONDEX_KONTEXT_SIDECAR_PATH: path.resolve('tests/e2e/fixtures/kontext-source-sidecar.mjs')
  }
})

test('registers a real non-Git Markdown source and refreshes its captured version', async ({
  orcaPage,
  registerPostElectronShutdownCleanup
}, testInfo) => {
  const folder = await realpath(await mkdtemp(path.join(os.tmpdir(), 'kondex-source-e2e-')))
  registerPostElectronShutdownCleanup(() => rm(folder, { recursive: true, force: true }))
  const source = path.join(folder, 'decisions.md')
  const initial = '# Decisions\n\n## Consistency\nAlways preserve the original domain term.\n'
  await writeFile(source, initial)
  const selector = await orcaPage.evaluate(async (folderPath) => {
    const group = await window.api.projectGroups.create({ name: 'Source fixture' })
    const workspace = await window.api.folderWorkspaces.create({
      projectGroupId: group.id,
      name: 'Markdown fixture',
      folderPath
    })
    await window.__store!.getState().updateSettings({ uiLanguage: 'en' })
    window.__store!.setState({ activeView: 'tasks' })
    return `folder:${workspace.id}`
  }, folder)
  await orcaPage.getByLabel('Source workspace path or selector').fill(selector)
  await orcaPage.getByLabel('Workspace-relative Markdown path').fill('decisions.md')
  await orcaPage.getByRole('button', { name: 'Register / refresh source' }).click()
  await expect(orcaPage.getByText('Source snapshot registered', { exact: true })).toBeVisible()
  const hash = (body: string) => `sha256:${createHash('sha256').update(body).digest('hex')}`
  await expect(orcaPage.getByText(hash(initial), { exact: true })).toBeVisible()
  await expect(orcaPage.getByText(/Registration itself grants no model access/)).toBeVisible()
  await expect(
    orcaPage.getByText('Always preserve the original domain term.', { exact: true })
  ).toHaveCount(0)
  const resourceId = await orcaPage.getByLabel('Registered Resource ID').inputValue()
  const inspect = () => orcaPage.getByRole('button', { name: 'Read saved permissions' }).click()
  const consent = () =>
    orcaPage.getByRole('checkbox', { name: /I confirm these model permissions/ }).click()
  const save = () => orcaPage.getByRole('button', { name: 'Save model permissions' }).click()
  await inspect()
  await expect(orcaPage.getByText('Saved model permissions: None', { exact: true })).toBeVisible()
  await orcaPage.getByRole('checkbox', { name: 'Codex', exact: true }).click()
  await orcaPage.getByRole('checkbox', { name: 'Claude', exact: true }).click()
  await consent()
  await save()
  await expect(
    orcaPage.getByText('Saved model permissions: claude, codex', { exact: true })
  ).toBeVisible()
  await inspect()
  await expect(
    orcaPage.getByText('Saved model permissions: claude, codex', { exact: true })
  ).toBeVisible()
  await orcaPage.getByRole('button', { name: 'Register / refresh source' }).click()
  await expect(orcaPage.getByText('Source snapshot unchanged', { exact: true })).toBeVisible()
  const updated = `${initial}\n## Revision\nRevalidate after infrastructure recovery.\n`
  await writeFile(source, updated)
  await orcaPage.getByRole('button', { name: 'Register / refresh source' }).click()
  await expect(orcaPage.getByText('Source snapshot registered', { exact: true })).toBeVisible()
  await expect(orcaPage.getByText(hash(updated), { exact: true })).toBeVisible()
  await inspect()
  await expect(orcaPage.getByText('Saved model permissions: None', { exact: true })).toBeVisible()
  await orcaPage.getByRole('checkbox', { name: 'Claude', exact: true }).click()
  await consent()
  await save()
  await expect(orcaPage.getByText('Saved model permissions: claude', { exact: true })).toBeVisible()
  await orcaPage.getByRole('region', { name: 'Source model permissions' }).screenshot({
    path: testInfo.outputPath('kondex-source-registered.png')
  })
  await orcaPage.evaluate(async () =>
    window.__store!.getState().updateSettings({ uiLanguage: 'ko' })
  )
  await expect(orcaPage.getByText('근거 스냅샷 등록됨', { exact: true })).toBeVisible()
  await orcaPage.getByRole('region', { name: '근거의 모델 사용 권한' }).screenshot({
    path: testInfo.outputPath('kondex-source-registered-ko.png')
  })
  await orcaPage.evaluate(async () =>
    window.__store!.getState().updateSettings({ uiLanguage: 'en' })
  )
  await orcaPage.reload()
  await orcaPage.waitForFunction(() => Boolean(window.__store))
  await orcaPage.evaluate(() => window.__store!.setState({ activeView: 'tasks' }))
  await orcaPage.getByLabel('Registered Resource ID').fill(resourceId)
  await inspect()
  await expect(orcaPage.getByText('Saved model permissions: claude', { exact: true })).toBeVisible()
  await orcaPage.getByLabel('Source workspace path or selector').fill(selector)
  await orcaPage.getByLabel('Workspace-relative Markdown path').fill('decisions.md')
  await rm(source)
  await orcaPage.getByRole('button', { name: 'Register / refresh source' }).click()
  await expect(orcaPage.getByRole('alert')).toContainText('Registration was not confirmed')
  await expect(orcaPage.getByText('Source snapshot registered', { exact: true })).toHaveCount(0)
  await orcaPage.getByLabel('Registered Resource ID').fill(resourceId)
  await inspect()
  await expect(orcaPage.getByText(/Source needs recapture/)).toBeVisible()
  await orcaPage.getByRole('checkbox', { name: 'Claude', exact: true }).click()
  await consent()
  await save()
  await expect(orcaPage.getByText('Saved model permissions: None', { exact: true })).toBeVisible()
  await writeFile(source, updated)
  await orcaPage.getByRole('button', { name: 'Recapture registered source' }).click()
  await expect(orcaPage.getByText(/Captured source is active/)).toBeVisible()
  await expect(orcaPage.getByText('Saved model permissions: None', { exact: true })).toBeVisible()
})
