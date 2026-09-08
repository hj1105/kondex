import path from 'node:path'
import { test, expect } from './helpers/orca-app'
test.use({
  orcaAppExtraEnv: {
    KONDEX_KONTEXT_SIDECAR_PATH: path.resolve('tests/e2e/fixtures/kontext-workbench-sidecar.mjs'),
    KONDEX_E2E_REGISTERED_SCHEDULE_FIXTURE: '1'
  }
})
test('pages to an older execution, controls only that run and restores its saved intent after reload', async ({
  orcaPage
}, testInfo) => {
  await orcaPage.evaluate(async () => {
    await window.__store!.getState().updateSettings({ uiLanguage: 'en' })
    window.__store!.setState({ activeView: 'tasks' })
  })
  await orcaPage.getByRole('button', { name: 'Load task list', exact: true }).click()
  await orcaPage
    .getByRole('button', { name: 'Open task: Verify the registered logic workflow' })
    .click()
  const history = orcaPage.getByRole('region', { name: 'Execution history', exact: true })
  await history.getByRole('button', { name: 'Load execution history', exact: true }).click()
  await expect(
    history.getByRole('button', { name: 'Select execution: job:older', exact: true })
  ).toHaveCount(0)
  await history.getByRole('button', { name: 'Load more executions', exact: true }).click()
  await history.getByLabel('Search loaded executions…').fill('job:older')
  await history.getByRole('button', { name: 'Select execution: job:older', exact: true }).click()
  const record = history.getByRole('region', { name: 'Host execution record', exact: true })
  await expect(record.getByText('job:older', { exact: true })).toBeVisible()
  await expect(record.getByRole('checkbox')).toHaveCount(0)
  await record.getByRole('button', { name: 'Read saved execution', exact: true }).click()
  await record.getByRole('checkbox').check()
  await history.getByLabel('Search loaded executions…').fill('job:fixture')
  await history.getByRole('button', { name: 'Select execution: job:fixture', exact: true }).click()
  await expect(record.getByRole('checkbox')).toHaveCount(0)
  await record.getByRole('button', { name: 'Read saved execution', exact: true }).click()
  await expect(record.getByRole('checkbox')).not.toBeChecked()
  await history.getByLabel('Search loaded executions…').fill('job:older')
  await history.getByRole('button', { name: 'Select execution: job:older', exact: true }).click()
  await record.getByRole('button', { name: 'Read saved execution', exact: true }).click()
  await record.getByRole('button', { name: 'Request execution cancellation', exact: true }).click()
  await expect(record.getByText('2026-09-07T00:00:00.000Z', { exact: true })).toBeVisible()
  await expect(record.getByText('Interrupted', { exact: true })).toBeVisible()
  await history.screenshot({ path: testInfo.outputPath('kondex-history-en.png') })
  await orcaPage.reload()
  await orcaPage.waitForFunction(() => Boolean(window.__store))
  await orcaPage.evaluate(() => window.__store!.setState({ activeView: 'tasks' }))
  await orcaPage.getByRole('button', { name: 'Load task list', exact: true }).click()
  await orcaPage
    .getByRole('button', { name: 'Open task: Verify the registered logic workflow' })
    .click()
  await record.getByRole('button', { name: 'Read saved execution', exact: true }).click()
  await expect(record.getByText('job:fixture', { exact: true })).toBeVisible()
  await expect(
    record.getByRole('button', { name: 'Request execution cancellation', exact: true })
  ).toBeEnabled()
  await history.getByRole('button', { name: 'Load execution history', exact: true }).click()
  await history.getByRole('button', { name: 'Load more executions', exact: true }).click()
  await history.getByLabel('Search loaded executions…').fill('job:older')
  await history.getByRole('button', { name: 'Select execution: job:older', exact: true }).click()
  await record.getByRole('button', { name: 'Read saved execution', exact: true }).click()
  await expect(
    record.getByRole('button', { name: 'Request execution cancellation', exact: true })
  ).toBeDisabled()
  await expect(
    orcaPage.getByRole('button', { name: 'Recover original request', exact: true })
  ).toHaveCount(0)
  await orcaPage.evaluate(async () =>
    window.__store!.getState().updateSettings({ uiLanguage: 'ko' })
  )
  const korean = orcaPage.getByRole('region', { name: '실행 이력', exact: true })
  await expect(
    korean.getByRole('button', { name: '실행 선택: job:older', exact: true })
  ).toBeVisible()
  await korean.screenshot({ path: testInfo.outputPath('kondex-history-ko.png') })
  await orcaPage.evaluate(async () => window.__store!.getState().updateSettings({ theme: 'dark' }))
  await expect(orcaPage.locator('html')).toHaveClass(/dark/)
  await korean.screenshot({ path: testInfo.outputPath('kondex-history-ko-dark.png') })
})
test('inspects a host execution without a local journal and explicitly resumes or cancels only its reviewed identity', async ({
  orcaPage
}, testInfo) => {
  await orcaPage.evaluate(async () => {
    await window.__store!.getState().updateSettings({ uiLanguage: 'en' })
    window.__store!.setState({ activeView: 'tasks' })
  })
  await orcaPage.getByRole('button', { name: 'Load task list', exact: true }).click()
  await orcaPage
    .getByRole('button', { name: 'Open task: Verify the registered logic workflow' })
    .click()
  const record = orcaPage.getByRole('region', { name: 'Host execution record', exact: true })
  await expect(
    record.getByRole('button', { name: 'Revalidate / resume this execution' })
  ).toHaveCount(0)
  await record.getByRole('button', { name: 'Read saved execution', exact: true }).click()
  await expect(record.getByText('Interrupted', { exact: true })).toBeVisible()
  await expect(
    record.getByRole('button', { name: 'Revalidate / resume this execution' })
  ).toBeDisabled()
  await record.getByRole('checkbox').check()
  await record.getByRole('button', { name: 'Revalidate / resume this execution' }).click()
  await expect(record.getByText(/Resume blocked by existing validation/)).toBeVisible()
  await expect(record.getByRole('checkbox')).not.toBeChecked()
  await record.getByRole('button', { name: 'Request execution cancellation' }).click()
  await expect(record.getByText('2026-09-07T00:00:00.000Z', { exact: true })).toBeVisible()
  await expect(record.getByText('Interrupted', { exact: true })).toBeVisible()
  await expect(
    record.getByRole('button', { name: 'Revalidate / resume this execution' })
  ).toBeDisabled()
  await expect(
    record.getByRole('button', { name: 'Request execution cancellation' })
  ).toBeDisabled()
  await record.screenshot({ path: testInfo.outputPath('kondex-host-schedule-en.png') })
  await orcaPage.reload()
  await orcaPage.waitForFunction(() => Boolean(window.__store))
  await orcaPage.evaluate(() => window.__store!.setState({ activeView: 'tasks' }))
  await orcaPage.getByRole('button', { name: 'Load task list', exact: true }).click()
  await orcaPage
    .getByRole('button', { name: 'Open task: Verify the registered logic workflow' })
    .click()
  await record.getByRole('button', { name: 'Read saved execution', exact: true }).click()
  await expect(
    record.getByRole('button', { name: 'Request execution cancellation' })
  ).toBeDisabled()
  await expect(
    orcaPage.getByRole('button', { name: 'Recover original request', exact: true })
  ).toHaveCount(0)
  await orcaPage.evaluate(async () =>
    window.__store!.getState().updateSettings({ uiLanguage: 'ko' })
  )
  const korean = orcaPage.getByRole('region', { name: '호스트 실행 기록', exact: true })
  await expect(korean.getByRole('button', { name: '이 실행 재검증·재개' })).toBeDisabled()
  await korean.screenshot({ path: testInfo.outputPath('kondex-host-schedule-ko.png') })
  await orcaPage.evaluate(async () => window.__store!.getState().updateSettings({ theme: 'dark' }))
  await expect(orcaPage.locator('html')).toHaveClass(/dark/)
  await korean.screenshot({ path: testInfo.outputPath('kondex-host-schedule-ko-dark.png') })
})
