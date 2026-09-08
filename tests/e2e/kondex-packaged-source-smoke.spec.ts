import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { _electron, test, expect, type ElectronApplication } from '@stablyai/playwright-test'
import { getE2ECompletedOnboardingProfile } from './helpers/e2e-completed-onboarding-profile'
import {
  assertElectronResolvedIsolatedHome,
  createElectronHomeIsolation
} from './helpers/electron-home-isolation'
import { cleanupE2EDaemons, closeElectronAppForE2E } from './helpers/electron-process-shutdown'

const executablePath = process.env.KONDEX_PACKAGED_SMOKE_EXECUTABLE

test('packaged production app registers a source through its bundled sidecar across restart', async (// oxlint-disable-next-line no-empty-pattern -- this test owns the packaged launches, not a development app fixture.
{}, testInfo) => {
  test.skip(!executablePath || process.platform !== 'darwin', 'Requires an explicit macOS package')
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'kondex-packaged-source-')))
  const profile = path.join(root, 'profile')
  const folder = path.join(root, 'workspace')
  const sourceText = '# Decisions\n\nKeep the original domain term.\n'
  const sourceHash = `sha256:${createHash('sha256').update(sourceText).digest('hex')}`
  let app: ElectronApplication | null = null
  try {
    await mkdir(profile)
    await mkdir(folder)
    await writeFile(path.join(folder, 'decisions.md'), sourceText)
    await writeFile(
      path.join(profile, 'orca-data.json'),
      JSON.stringify(getE2ECompletedOnboardingProfile())
    )
    const isolation = createElectronHomeIsolation({
      inheritedEnv: {},
      launchEnv: {
        PATH: '/usr/bin:/bin',
        TMPDIR: os.tmpdir(),
        LANG: 'en_US.UTF-8',
        ORCA_E2E_HEADLESS: '1',
        ORCA_BACKGROUND_LAUNCH: '1'
      },
      extraEnv: {},
      userDataDir: profile
    })
    let selector = ''
    let resourceId = ''
    const rendererErrors: string[] = []
    for (let launch = 0; launch < 2; launch++) {
      app = await _electron.launch({
        executablePath,
        args: ['--password-store=basic', '--use-mock-keychain'],
        env: isolation.env,
        timeout: 30_000
      })
      const identity = await app.evaluate(({ app, BrowserWindow }) => ({
        packaged: app.isPackaged,
        name: app.getName(),
        version: app.getVersion(),
        home: app.getPath('home'),
        profile: app.getPath('userData'),
        visibleWindows: BrowserWindow.getAllWindows().filter((window) => window.isVisible()).length
      }))
      assertElectronResolvedIsolatedHome(identity.home, isolation)
      expect(identity.packaged).toBe(true)
      expect(identity.name).toBe('Kondex')
      expect(identity.profile).toBe(profile)
      expect(identity.visibleWindows).toBe(0)
      const page = await app.firstWindow({ timeout: 30_000 })
      page.on('pageerror', (error) => rendererErrors.push(error.message))
      await page.waitForLoadState('domcontentloaded')
      await page.waitForFunction(() => Boolean(window.api))
      expect(await page.evaluate(() => typeof window.__store)).toBe('undefined')
      if (launch === 0) {
        selector = await page.evaluate(async (folderPath) => {
          const group = await window.api.projectGroups.create({ name: 'Packaged source smoke' })
          const workspace = await window.api.folderWorkspaces.create({
            projectGroupId: group.id,
            name: 'Packaged source',
            folderPath
          })
          return `folder:${workspace.id}`
        }, folder)
      }
      await page.getByRole('button', { name: 'Logic Work Items', exact: true }).click()
      if (launch === 1) {
        await page.getByLabel('Registered Resource ID').fill(resourceId)
        await page.getByRole('button', { name: 'Read saved permissions' }).click()
        await expect(page.getByText('Saved model permissions: None', { exact: true })).toBeVisible()
      }
      await page.getByLabel('Source workspace path or selector').fill(selector)
      await page.getByLabel('Workspace-relative Markdown path').fill('decisions.md')
      await page.getByRole('button', { name: 'Register / refresh source' }).click()
      await expect(
        page.getByText(launch === 0 ? 'Source snapshot registered' : 'Source snapshot unchanged', {
          exact: true
        })
      )
        .toBeVisible()
        .catch(async (error: unknown) => {
          await testInfo.attach('source-registration-dom', {
            body: await page.locator('body').innerText(),
            contentType: 'text/plain'
          })
          throw error
        })
      await expect(page.getByText(sourceHash, { exact: true })).toBeVisible()
      const registeredId = await page.getByLabel('Registered Resource ID').inputValue()
      if (launch === 0) {
        resourceId = registeredId
      }
      expect(registeredId).toBe(resourceId)
      expect(resourceId.length).toBeGreaterThan(0)
      await page.getByRole('button', { name: 'Read saved permissions' }).click()
      await expect(page.getByText('Saved model permissions: None', { exact: true })).toBeVisible()
      await page.getByRole('region', { name: 'Markdown sources', exact: true }).screenshot({
        path: testInfo.outputPath(`packaged-source-${launch}.png`),
        animations: 'disabled'
      })
      await page.getByRole('region', { name: 'Source model permissions', exact: true }).screenshot({
        path: testInfo.outputPath(`packaged-permissions-${launch}.png`),
        animations: 'disabled'
      })
      expect(rendererErrors).toEqual([])
      expect(
        await app.evaluate(
          ({ BrowserWindow }) =>
            BrowserWindow.getAllWindows().filter((window) => window.isVisible()).length
        )
      ).toBe(0)
      await testInfo.attach(`package-identity-${launch}`, {
        body: JSON.stringify(identity),
        contentType: 'application/json'
      })
      await closeElectronAppForE2E(app)
      app = null
    }
  } finally {
    if (app) {
      await closeElectronAppForE2E(app)
    }
    await cleanupE2EDaemons(profile)
    await rm(root, { recursive: true, force: true })
  }
})
