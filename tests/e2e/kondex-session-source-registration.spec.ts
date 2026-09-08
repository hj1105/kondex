import path from 'node:path'
import { test, expect } from './helpers/orca-app'
import { createNativeSourceGuiFixture } from './fixtures/kontext-native-source-fixture'

test.use({
  seedTestRepo: false,
  orcaAppExtraEnv: {
    KONDEX_KONTEXT_SIDECAR_PATH: path.resolve('tests/e2e/fixtures/kontext-source-sidecar.mjs')
  }
})
for (const provider of ['codex', 'claude'] as const) {
  test(`reviews and registers ${provider} journal evidence with separate model consent`, async ({
    electronApp,
    orcaPage,
    registerPostElectronShutdownCleanup
  }, testInfo) => {
    const source = await createNativeSourceGuiFixture(provider)
    registerPostElectronShutdownCleanup(() => source.close())
    await orcaPage.setViewportSize({ width: 1440, height: 1900 })
    await electronApp.evaluate(
      ({ ipcMain }, fixture) => {
        ipcMain.removeHandler('runtime:call')
        ipcMain.handle('runtime:call', async (_event, request) => {
          const response = await fetch(fixture.endpoint, {
            method: 'POST',
            headers: { authorization: `Bearer ${fixture.token}` },
            body: JSON.stringify(request)
          })
          return response.json()
        })
      },
      { endpoint: source.endpoint, token: source.token }
    )
    await orcaPage.evaluate(async () => {
      await window.__store!.getState().updateSettings({ uiLanguage: 'en' })
      window.__store!.setState({ activeView: 'tasks' })
    })
    await orcaPage.getByRole('tab', { name: 'Sessions', exact: true }).click()
    await expect(
      orcaPage.getByRole('heading', { name: 'Session sources', exact: true })
    ).toBeVisible()
    expect(source.calls.filter((method) => method.includes('SessionSource'))).toEqual([])
    await orcaPage.getByRole('button', { name: 'Load readable sessions' }).click()
    await orcaPage.getByRole('combobox', { name: 'Select a source session' }).click()
    await orcaPage.getByRole('combobox', { name: 'Search loaded sessions…' }).fill(source.sessionId)
    await orcaPage.getByRole('option', { name: new RegExp(source.sessionId) }).click()
    expect(source.calls).not.toContain('kontext.previewSessionSource')
    await orcaPage.getByRole('button', { name: 'Read source preview' }).click()
    await expect(orcaPage.getByRole('region', { name: 'Captured text for review' })).toContainText(
      'Keep the original domain term.'
    )
    await expect(orcaPage.getByRole('button', { name: 'Register reviewed session' })).toBeDisabled()
    await expect(orcaPage.getByRole('button', { name: 'Read source preview' })).toBeEnabled()
    await orcaPage
      .getByRole('region', { name: 'Session sources', exact: true })
      .screenshot({ path: testInfo.outputPath(`session-${provider}-preview.png`) })
    await orcaPage.getByRole('checkbox', { name: /I reviewed this exact captured text/ }).click()
    await source.add('A new decision arrived after the preview.')
    await orcaPage.getByRole('button', { name: 'Register reviewed session' }).click()
    await expect(orcaPage.getByRole('alert')).toContainText('operation was not confirmed')
    await expect(orcaPage.getByRole('region', { name: 'Captured text for review' })).toHaveCount(0)
    await orcaPage.getByRole('button', { name: 'Read source preview' }).click()
    await expect(orcaPage.getByRole('region', { name: 'Captured text for review' })).toContainText(
      'A new decision arrived'
    )
    await orcaPage.getByRole('checkbox', { name: /I reviewed this exact captured text/ }).click()
    await orcaPage.getByRole('button', { name: 'Register reviewed session' }).click()
    await expect(orcaPage.getByText('Source snapshot registered', { exact: true })).toBeVisible()
    await orcaPage.getByRole('button', { name: 'Read saved permissions' }).click()
    await expect(orcaPage.getByText('Saved model permissions: None', { exact: true })).toBeVisible()
    await orcaPage
      .getByRole('checkbox', { name: provider === 'codex' ? 'Codex' : 'Claude', exact: true })
      .click()
    await orcaPage.getByRole('checkbox', { name: /I confirm these model permissions/ }).click()
    await orcaPage.getByRole('button', { name: 'Save model permissions' }).click()
    await expect(
      orcaPage.getByText(`Saved model permissions: ${provider}`, { exact: true })
    ).toBeVisible()
    const resourceId = await orcaPage.getByLabel('Registered Resource ID').inputValue()
    await orcaPage.getByRole('combobox', { name: 'Planning runtime' }).click()
    await orcaPage
      .getByRole('option', { name: provider === 'codex' ? 'Codex' : 'Claude', exact: true })
      .click()
    await orcaPage.getByRole('combobox', { name: 'Browse registered sources' }).click()
    await expect(
      orcaPage.getByRole('option', { name: new RegExp(`Session ${source.sessionId}`) })
    ).toBeVisible()
    await orcaPage.getByRole('option', { name: new RegExp(`Session ${source.sessionId}`) }).click()
    await orcaPage.keyboard.press('Escape')
    await expect(orcaPage.getByLabel('Required source Resource IDs (one per line)')).toHaveValue(
      resourceId
    )
    await orcaPage.evaluate(async () => {
      await window.__store!.getState().updateSettings({ uiLanguage: 'ko' })
    })
    await expect(orcaPage.getByRole('heading', { name: '세션 출처', exact: true })).toBeVisible()
    await orcaPage
      .getByRole('region', { name: '세션 출처', exact: true })
      .screenshot({ path: testInfo.outputPath(`session-${provider}-registered-ko.png`) })
  })
}
