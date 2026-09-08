import { expect, type Locator, type Page } from '@stablyai/playwright-test'

/**
 * Opens the "Add a project" dialog from whichever control the current state offers.
 * The landing screen has a standalone Add Project button, but once a project exists
 * the only in-app path is the workspace composer's Add project action — the sidebar
 * carries no standalone control.
 */
export async function openAddProjectDialog(page: Page): Promise<Locator> {
  const landingButton = page.getByRole('button', { name: /Add Project/i }).first()
  const onLanding = await landingButton
    .waitFor({ state: 'visible', timeout: 2_000 })
    .then(() => true)
    .catch(() => false)
  if (onLanding) {
    await landingButton.click()
  } else {
    await page.getByRole('button', { name: 'New workspace', exact: true }).click()
    await page.getByRole('button', { name: 'Add project', exact: true }).first().click()
  }
  const dialog = page.getByRole('dialog', { name: /Add a project/i })
  await expect(dialog).toBeVisible({ timeout: 10_000 })
  return dialog
}
