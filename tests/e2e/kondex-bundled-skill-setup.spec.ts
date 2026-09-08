import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { test, expect } from './helpers/orca-app'

test.use({ seedTestRepo: false })

test('installs bundled skills through the renderer and preserves local edits on update', async ({
  electronApp,
  orcaPage
}, testInfo) => {
  await orcaPage.evaluate(async () => {
    const state = window.__store!.getState()
    await state.updateSettings({ uiLanguage: 'en' })
    state.openSettingsPage()
  })
  await expect(orcaPage.getByPlaceholder('Search settings')).toBeVisible()
  await orcaPage.getByRole('button', { name: /^Computer Use\b/ }).click()
  const heading = orcaPage.getByRole('heading', { name: 'Computer Use skill', exact: true })
  await expect(heading).toBeVisible()
  const panel = heading.locator('..').locator('..')
  await expect(panel.getByText('Not installed', { exact: true })).toBeVisible()
  await expect(panel.getByText('Agent integrations', { exact: true })).toBeVisible()
  await panel.getByRole('checkbox', { name: 'Codex', exact: true }).uncheck()
  await panel.getByRole('checkbox', { name: 'Claude', exact: true }).uncheck()
  await panel.getByRole('button', { name: 'Install', exact: true }).click()
  await expect(panel.getByRole('button', { name: 'Update', exact: true })).toBeEnabled({
    timeout: 30_000
  })
  await expect(panel.getByRole('alert')).toHaveCount(0)

  const isolatedHome = await electronApp.evaluate(({ app }) => app.getPath('home'))
  const skillFile = path.join(isolatedHome, '.agents', 'skills', 'kondex-computer-use', 'SKILL.md')
  const installed = await readFile(skillFile, 'utf8')
  expect(installed).toContain('name: kondex-computer-use')
  expect(installed).toContain('KONDEX skills get kondex-computer-use')
  await orcaPage.evaluate(() => window.api.skills.startUpdateRun(['kondex-computer-use']))
  await expect(
    orcaPage.getByRole('button', { name: 'Skills updated. Click to open details.', exact: true })
  ).toBeVisible()
  await orcaPage.screenshot({ path: testInfo.outputPath('bundled-skill-installed.png') })

  const modified = `${installed}\nLocal note retained by the user.\n`
  await writeFile(skillFile, modified)
  await panel.getByRole('button', { name: 'Update', exact: true }).click()
  await expect(panel.getByRole('alert')).toContainText('kept-local', { timeout: 30_000 })
  await expect(panel.getByRole('button', { name: 'Update', exact: true })).toBeEnabled()
  await expect(orcaPage.getByText('The status bar hit an error.', { exact: true })).toHaveCount(0)
  expect(await readFile(skillFile, 'utf8')).toBe(modified)
  await orcaPage.evaluate(() => window.api.skills.startUpdateRun(['kondex-computer-use']))
  await expect(
    orcaPage.getByRole('button', {
      name: 'Skill update failed. Click to open details.',
      exact: true
    })
  ).toBeVisible()
  expect(await readFile(skillFile, 'utf8')).toBe(modified)
  await orcaPage.screenshot({ path: testInfo.outputPath('bundled-skill-local-edit.png') })
})
