import path from 'node:path'
import { test, expect } from './helpers/orca-app'

test.use({
  orcaAppExtraEnv: {
    KONDEX_KONTEXT_SIDECAR_PATH: path.resolve('tests/e2e/fixtures/kontext-workbench-sidecar.mjs'),
    KONDEX_E2E_FINALIZATION_FIXTURE: '1'
  }
})
test('records reviewed fixture completion and recovers its lost response after renderer reload', async ({
  orcaPage,
  testRepoPath
}, testInfo) => {
  await orcaPage.evaluate(async () => {
    await window.__store!.getState().updateSettings({ uiLanguage: 'en' })
    window.__store!.setState({ activeView: 'tasks' })
  })
  await orcaPage.getByLabel('Task ID', { exact: true }).fill('task:e2e')
  await orcaPage.getByRole('button', { name: 'Load task', exact: true }).click()
  await orcaPage.getByLabel('Worktree path or selector').fill(testRepoPath)
  await orcaPage.getByRole('checkbox', { name: /Allow subscription CLI execution/ }).check()
  await orcaPage.getByRole('button', { name: 'Start schedule', exact: true }).click()
  await expect(orcaPage.getByText('Outcome unknown', { exact: true })).toBeVisible()
  await orcaPage.getByRole('button', { name: 'Recover original request' }).click()
  await orcaPage.getByRole('button', { name: 'Refresh / revalidate' }).click()
  await expect(orcaPage.getByText('Running', { exact: true })).toBeVisible()
  await orcaPage.getByRole('button', { name: 'Refresh / revalidate' }).click()
  await expect(orcaPage.getByRole('button', { name: 'Record Task completion' })).toBeDisabled()
  await orcaPage.getByRole('button', { name: 'Assess completion', exact: true }).click()
  await expect(
    orcaPage.getByText('Completion requirements met at observation', { exact: true })
  ).toBeVisible()
  await expect(orcaPage.getByRole('button', { name: 'Record Task completion' })).toBeDisabled()
  await orcaPage
    .getByRole('checkbox', { name: /I reviewed this exact completion evidence/ })
    .check()
  await orcaPage.getByRole('button', { name: 'Record Task completion' }).click()
  await expect(orcaPage.getByText(/Finalization was not confirmed/)).toBeVisible()
  await orcaPage.reload()
  await orcaPage.waitForFunction(() => Boolean(window.__store))
  await orcaPage.evaluate(() => window.__store!.setState({ activeView: 'tasks' }))
  await expect(orcaPage.getByRole('button', { name: 'Recover saved finalization' })).toBeDisabled()
  await orcaPage.getByRole('button', { name: 'Read completion record' }).click()
  await expect(orcaPage.getByText(/Completion recorded at:/)).toBeVisible()
  await expect(orcaPage.getByText(/Historical record/)).toBeVisible()
  await expect(orcaPage.getByText(/Recorded completion valid at observation/)).toHaveCount(0)
  await orcaPage.getByRole('button', { name: 'Revalidate recorded completion' }).click()
  await expect(orcaPage.getByText(/Recorded completion valid at observation/)).toBeVisible()
  await orcaPage.getByText(/Completion recorded at:/).scrollIntoViewIfNeeded()
  await orcaPage.screenshot({ path: testInfo.outputPath('kondex-finalization-record.png') })
  await orcaPage.evaluate(async () =>
    window.__store!.getState().updateSettings({ uiLanguage: 'ko' })
  )
  await expect(orcaPage.getByRole('button', { name: '완료 기록 조회' })).toBeVisible()
  await expect(orcaPage.getByText(/관찰 시점에 완료 기록 유효/)).toBeVisible()
  await orcaPage.screenshot({ path: testInfo.outputPath('kondex-finalization-record-ko.png') })
  await orcaPage.evaluate(async () => window.__store!.getState().updateSettings({ theme: 'dark' }))
  await expect(orcaPage.locator('html')).toHaveClass(/dark/)
  await expect(orcaPage.getByText(/관찰 시점에 완료 기록 유효/)).toBeVisible()
  await orcaPage.screenshot({ path: testInfo.outputPath('kondex-finalization-record-ko-dark.png') })
  await orcaPage.evaluate(async () => {
    await window.__store!.getState().updateSettings({ uiLanguage: 'en', theme: 'light' })
    for (const key of Object.keys(window.localStorage)) {
      if (
        key.startsWith('kondex.kontext.enqueue.v1.') ||
        key.startsWith('kondex.kontext.finalization.v1.')
      ) {
        window.localStorage.removeItem(key)
      }
    }
  })
  await orcaPage.reload()
  await orcaPage.waitForFunction(() => Boolean(window.__store))
  await orcaPage.evaluate(() => window.__store!.setState({ activeView: 'tasks' }))
  const inventory = orcaPage.getByRole('region', { name: 'Registered task list', exact: true })
  await inventory.getByRole('button', { name: 'Load task list', exact: true }).click()
  await expect(inventory.getByText('Historical completion time', { exact: true })).toBeVisible()
  await expect(inventory.getByText(/Recorded completion valid at observation/)).toHaveCount(0)
  await inventory
    .getByRole('button', { name: 'Open task: Verify the registered logic workflow' })
    .click()
  await expect(orcaPage.getByLabel('Task ID', { exact: true })).toHaveValue('task:e2e')
  await expect(orcaPage.getByLabel('Worktree path or selector')).toHaveValue(testRepoPath)
  await expect(orcaPage.getByRole('button', { name: 'Start schedule', exact: true })).toBeDisabled()
  await expect(orcaPage.getByRole('button', { name: 'Recover original request' })).toHaveCount(0)
  await inventory.getByRole('button', { name: 'Read completion record', exact: true }).click()
  await expect(inventory.getByText(/Completion recorded at:/)).toBeVisible()
  await expect(
    inventory.getByRole('button', { name: 'Record Task completion', exact: true })
  ).toHaveCount(0)
  await inventory.getByRole('button', { name: 'Revalidate recorded completion' }).click()
  await expect(inventory.getByText(/Recorded completion valid at observation/)).toBeVisible()
  await inventory.screenshot({ path: testInfo.outputPath('kondex-task-list-en.png') })
  await orcaPage.evaluate(async () =>
    window.__store!.getState().updateSettings({ uiLanguage: 'ko' })
  )
  const korean = orcaPage.getByRole('region', { name: '등록 작업 목록', exact: true })
  await expect(korean.getByText(/관찰 시점에 완료 기록 유효/)).toBeVisible()
  await korean.screenshot({ path: testInfo.outputPath('kondex-task-list-ko.png') })
  await orcaPage.evaluate(async () => window.__store!.getState().updateSettings({ theme: 'dark' }))
  await expect(orcaPage.locator('html')).toHaveClass(/dark/)
  await korean.screenshot({ path: testInfo.outputPath('kondex-task-list-ko-dark.png') })
})
