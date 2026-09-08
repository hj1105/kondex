import { expect, test } from './helpers/orca-app'

test.use({ dismissOnboarding: false, seedTestRepo: false })
test.skip(process.platform !== 'win32', 'Fresh-profile fsync regression is Windows-only')

test('fresh Windows profile reaches the project landing page @windows-fresh-startup-golden', async ({
  orcaPage
}) => {
  await expect(orcaPage.getByRole('heading', { name: 'KONDEX' })).toBeVisible({
    timeout: 30_000
  })
  await expect(orcaPage.getByRole('button', { name: /Add Project/i })).toBeVisible()
})
