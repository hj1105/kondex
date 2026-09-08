import { test, expect } from './helpers/orca-app'

test.use({ seedTestRepo: false })

test('keeps the status bar mounted in a fresh profile without agents or a project', async ({
  orcaPage
}) => {
  await orcaPage.evaluate(async () => {
    await window.__store!.getState().updateSettings({ uiLanguage: 'en' })
  })
  await expect(
    orcaPage.getByRole('button', { name: 'Ports, 0 workspace ports', exact: true })
  ).toBeVisible()
  await expect(
    orcaPage.getByText('Retry the status bar to remount its controls.', { exact: true })
  ).toHaveCount(0)
  await expect(orcaPage.getByText('The status bar hit an error.', { exact: true })).toHaveCount(0)
})
