import path from 'node:path'
import { test, expect } from './helpers/orca-app'
test.use({
  orcaAppExtraEnv: {
    KONDEX_KONTEXT_SIDECAR_PATH: path.resolve('tests/e2e/fixtures/kontext-workbench-sidecar.mjs'),
    KONDEX_E2E_REGISTERED_SCHEDULE_FIXTURE: '1',
    KONDEX_E2E_REGISTERED_INTEGRATION_FIXTURE: '1'
  }
})
test('integrates a reviewed older execution and recovers its lost response without replay or cached completion', async ({
  orcaPage
}, testInfo) => {
  await orcaPage.evaluate(async () => {
    await window.__store!.getState().updateSettings({ uiLanguage: 'en' })
    window.__store!.setState({ activeView: 'tasks' })
  })
  async function selectOlder() {
    await orcaPage.getByRole('button', { name: 'Load task list', exact: true }).click()
    await orcaPage
      .getByRole('button', { name: 'Open task: Verify the registered logic workflow' })
      .click()
    const history = orcaPage.getByRole('region', { name: 'Execution history', exact: true })
    await history.getByRole('button', { name: 'Load execution history', exact: true }).click()
    await history.getByRole('button', { name: 'Load more executions', exact: true }).click()
    await history.getByLabel('Search loaded executions…').fill('job:older')
    await history.getByRole('button', { name: 'Select execution: job:older', exact: true }).click()
    await history.getByRole('button', { name: 'Read saved execution', exact: true }).click()
  }
  await selectOlder()
  const integration = orcaPage.getByRole('region', {
    name: 'Selected execution integration',
    exact: true
  })
  await expect(integration.getByRole('checkbox')).toHaveCount(0)
  await integration.getByRole('button', { name: 'Read saved integration', exact: true }).click()
  await expect(integration.getByText(/No saved integration record/)).toBeVisible()
  await expect(
    integration.getByRole('button', { name: 'Integrate this reviewed execution', exact: true })
  ).toBeDisabled()
  await integration.getByRole('checkbox').check()
  await integration
    .getByRole('button', { name: 'Integrate this reviewed execution', exact: true })
    .click()
  await expect(integration.getByRole('alert')).toBeVisible()
  await expect(integration.getByRole('checkbox')).toHaveCount(0)
  await integration.getByRole('button', { name: 'Read saved integration', exact: true }).click()
  await expect(integration.getByText('commit:older-integration', { exact: true })).toBeVisible()
  await expect(
    integration.getByRole('button', { name: 'Assess completion', exact: true })
  ).toBeVisible()
  await expect(
    integration.getByText('Completion requirements met at observation', { exact: true })
  ).toHaveCount(0)
  await expect(
    integration.getByRole('button', { name: 'Integrate this reviewed execution', exact: true })
  ).toHaveCount(0)
  await integration.screenshot({ path: testInfo.outputPath('kondex-owned-integration-en.png') })
  await orcaPage.reload()
  await orcaPage.waitForFunction(() => Boolean(window.__store))
  await orcaPage.evaluate(() => window.__store!.setState({ activeView: 'tasks' }))
  await selectOlder()
  await integration.getByRole('button', { name: 'Read saved integration', exact: true }).click()
  await expect(integration.getByText('commit:older-integration', { exact: true })).toBeVisible()
  await expect(
    orcaPage.getByRole('button', { name: 'Recover original request', exact: true })
  ).toHaveCount(0)
  await orcaPage.evaluate(async () =>
    window.__store!.getState().updateSettings({ uiLanguage: 'ko' })
  )
  const korean = orcaPage.getByRole('region', { name: '선택한 실행의 결과 통합', exact: true })
  await expect(korean.getByRole('button', { name: '완료 조건 확인', exact: true })).toBeVisible()
  await korean.screenshot({ path: testInfo.outputPath('kondex-owned-integration-ko.png') })
  await orcaPage.evaluate(async () => window.__store!.getState().updateSettings({ theme: 'dark' }))
  await expect(orcaPage.locator('html')).toHaveClass(/dark/)
  await korean.screenshot({ path: testInfo.outputPath('kondex-owned-integration-ko-dark.png') })
})
