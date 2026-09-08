import path from 'node:path'
import { test, expect } from './helpers/orca-app'

test.use({
  orcaAppExtraEnv: {
    KONDEX_KONTEXT_SIDECAR_PATH: path.resolve('tests/e2e/fixtures/kontext-workbench-sidecar.mjs')
  }
})

test('recovers a saved request across renderer reload and inspects integration evidence', async ({
  orcaPage,
  testRepoPath
}, testInfo) => {
  await orcaPage.evaluate(async () => {
    await window.__store!.getState().updateSettings({ uiLanguage: 'en' })
    window.__store!.setState({ activeView: 'tasks' })
  })
  await orcaPage.getByLabel('Task ID', { exact: true }).fill('task:e2e')
  await orcaPage.getByRole('button', { name: 'Load task', exact: true }).click()
  await expect(
    orcaPage.getByText('Verify the registered logic workflow', { exact: true })
  ).toBeVisible()
  await orcaPage.getByLabel('Worktree path or selector').fill(testRepoPath)
  await expect(orcaPage.getByRole('button', { name: 'Start schedule', exact: true })).toBeDisabled()
  await orcaPage.getByRole('checkbox', { name: /Allow subscription CLI execution/ }).check()
  await orcaPage.getByRole('button', { name: 'Start schedule', exact: true }).click()
  await expect(orcaPage.getByText('Outcome unknown', { exact: true })).toBeVisible()
  await orcaPage.reload()
  await orcaPage.waitForFunction(() => Boolean(window.__store))
  await orcaPage.evaluate(() => window.__store!.setState({ activeView: 'tasks' }))
  await expect(orcaPage.getByText('Outcome unknown', { exact: true })).toBeVisible()
  await expect(orcaPage.getByRole('button', { name: 'Recover original request' })).toBeDisabled()
  await orcaPage.getByRole('checkbox', { name: /Allow subscription CLI execution/ }).check()
  await orcaPage.getByRole('button', { name: 'Recover original request' }).click()
  await expect(orcaPage.getByText('Queued', { exact: true })).toBeVisible()
  await orcaPage.getByRole('button', { name: 'Refresh / revalidate' }).click()
  await expect(orcaPage.getByText('Running', { exact: true })).toBeVisible()
  await orcaPage.getByRole('button', { name: 'Refresh / revalidate' }).click()
  await expect(orcaPage.getByText('Runner finished', { exact: true })).toHaveCount(2)
  await expect(
    orcaPage.getByRole('listitem').getByText('Runner finished', { exact: true })
  ).toBeVisible()
  await orcaPage.getByRole('button', { name: 'Integrate and verify' }).click()
  await expect(orcaPage.getByText(/Fixture only — no code verification was run/)).toBeVisible()
  await expect(
    orcaPage.getByText(/Runner completion is not verified Task completion/)
  ).toBeVisible()
  await orcaPage.getByRole('heading', { name: 'Registered tasks' }).scrollIntoViewIfNeeded()
  await orcaPage.screenshot({ path: testInfo.outputPath('kondex-task-workbench.png') })
  await orcaPage.getByRole('button', { name: 'Assess completion', exact: true }).click()
  await expect(
    orcaPage.getByText('Awaiting completion evidence or owner approval', { exact: true })
  ).toBeVisible()
  await expect(
    orcaPage.getByText('Fixture only — completion evidence has not been verified', { exact: true })
  ).toBeVisible()
  await orcaPage.getByRole('region', { name: 'Task completion evidence' }).scrollIntoViewIfNeeded()
  await orcaPage.screenshot({ path: testInfo.outputPath('kondex-completion-evidence.png') })
  await orcaPage.evaluate(async () =>
    window.__store!.getState().updateSettings({ uiLanguage: 'ko' })
  )
  await expect(orcaPage.getByRole('button', { name: '완료 조건 확인' })).toBeVisible()
  await orcaPage.screenshot({ path: testInfo.outputPath('kondex-completion-evidence-ko.png') })
  await orcaPage.getByRole('button', { name: '완료 조건 확인' }).click()
  await expect(orcaPage.getByText(/완료를 확인하지 못했습니다/)).toBeVisible()
  await expect(
    orcaPage.getByText('Fixture only — completion evidence has not been verified', { exact: true })
  ).toHaveCount(0)
})

test('keeps cancellation pending until the sidecar confirms settlement', async ({
  orcaPage,
  testRepoPath
}) => {
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
  await expect(orcaPage.getByText('Queued', { exact: true })).toBeVisible()
  await orcaPage.getByRole('checkbox', { name: /Allow subscription CLI execution/ }).uncheck()
  await orcaPage.getByRole('button', { name: 'Request cancellation' }).click()
  await expect(orcaPage.getByText('Cancellation pending', { exact: true })).toBeVisible()
  await expect(orcaPage.getByText('Cancellation confirmed', { exact: true })).toHaveCount(0)
})
