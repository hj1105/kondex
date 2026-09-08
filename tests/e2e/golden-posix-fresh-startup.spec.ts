import { expect, test } from './helpers/orca-app'

test.skip(process.platform === 'win32', 'POSIX fresh-startup golden; Windows has its own suite')

test.describe('POSIX fresh startup golden', () => {
  test.use({ dismissOnboarding: false, seedTestRepo: false })

  test('fresh profile reaches the project landing page @posix-profile-index-golden', async ({
    orcaPage
  }) => {
    await expect(orcaPage.getByRole('heading', { name: 'KONDEX' })).toBeVisible({
      timeout: 30_000
    })
    await expect(orcaPage.getByRole('button', { name: /Add Project/i })).toBeVisible()
  })
})
