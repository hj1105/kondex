import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import type { ElectronApplication } from '@stablyai/playwright-test'
import { test, expect } from './helpers/orca-app'
import { createRestartSession } from './helpers/orca-restart'
import { seedPersistedSessionSources } from './fixtures/kontext-persisted-session-source'

test('restores native source journals through production startup and RPC without model dispatch', async (// oxlint-disable-next-line no-empty-pattern -- this test owns both isolated Electron launches.
{}, testInfo) => {
  test.skip(process.platform === 'win32', 'Provider tripwire binaries use POSIX shebangs')
  const session = createRestartSession(testInfo, {
    KONDEX_KONTEXT_SIDECAR_PATH: path.resolve('tests/e2e/fixtures/kontext-source-sidecar.mjs')
  })
  let app: ElectronApplication | null = null
  try {
    const folderPath = path.join(session.userDataDir, 'source-workspace')
    await mkdir(folderPath)
    const setup = await session.launch()
    app = setup.app
    const workspaceId = await setup.page.evaluate(async (folderPath) => {
      const group = await window.api.projectGroups.create({ name: 'Native sources' })
      const workspace = await window.api.folderWorkspaces.create({
        projectGroupId: group.id,
        name: 'Source workspace',
        folderPath
      })
      return workspace.id
    }, folderPath)
    await session.close(app)
    app = null
    const fixture = await seedPersistedSessionSources(session.userDataDir, workspaceId)
    const registered = new Map<string, string>()
    for (let launch = 0; launch < 2; launch++) {
      const opened = await session.launch({ extraEnv: { PATH: `${fixture.bin}:/usr/bin:/bin` } })
      app = opened.app
      const page = opened.page
      const restored = await page.evaluate(() =>
        window.api.runtime.call({ method: 'session.tabs.listAll', params: null })
      )
      expect(restored.ok).toBe(true)
      await page.evaluate(async () => {
        await window.__store!.getState().updateSettings({ uiLanguage: 'en' })
        window.__store!.setState({ activeView: 'tasks' })
      })
      await page.getByRole('tab', { name: 'Sessions', exact: true }).click()
      await page.getByRole('button', { name: 'Load readable sessions' }).click()
      await expect(page.getByRole('combobox', { name: 'Select a source session' })).toBeVisible({
        timeout: 5000
      })
      for (const provider of ['codex', 'claude'] as const) {
        const sessionId = `persisted-source-${provider}`
        await page.getByRole('combobox', { name: 'Select a source session' }).click()
        await page.getByRole('combobox', { name: 'Search loaded sessions…' }).fill(sessionId)
        await page.getByRole('option', { name: new RegExp(sessionId) }).click()
        await page.getByRole('button', { name: 'Read source preview' }).click()
        await expect(page.getByRole('region', { name: 'Captured text for review' })).toContainText(
          `Keep the original ${provider} domain term.`
        )
        await expect(page.getByRole('button', { name: 'Read source preview' })).toBeEnabled()
        if (launch === 1) {
          await page.getByRole('region', { name: 'Session sources', exact: true }).screenshot({
            animations: 'disabled',
            path: testInfo.outputPath(`restored-${provider}-source.png`)
          })
        }
        await expect(page.getByRole('button', { name: 'Register reviewed session' })).toBeDisabled()
        await page.getByRole('checkbox', { name: /I reviewed this exact captured text/ }).click()
        await page.getByRole('button', { name: 'Register reviewed session' }).click()
        await expect(page.getByText('Source snapshot registered', { exact: true })).toBeVisible()
        const resourceId = await page.getByLabel('Registered Resource ID').inputValue()
        expect(resourceId).not.toBe('')
        if (launch === 0) {
          registered.set(provider, resourceId)
        } else {
          expect(resourceId).toBe(registered.get(provider))
        }
        await page.getByRole('button', { name: 'Read saved permissions' }).click()
        await expect(page.getByText('Saved model permissions: None', { exact: true })).toBeVisible()
      }
      await session.close(app)
      app = null
      const attempted = await readFile(fixture.attempted, 'utf8').catch((error) => {
        if (error.code === 'ENOENT') {
          return ''
        }
        throw error
      })
      for (const line of attempted.trim().split('\n').filter(Boolean)) {
        const entry = JSON.parse(line)
        expect(entry.kind, line).not.toBe('forbidden')
        if (entry.kind === 'launch') {
          expect(entry).toEqual({ kind: 'launch', provider: 'codex', args: ['app-server'] })
        } else {
          expect(['initialize', 'initialized', 'hooks/list']).toContain(entry.method)
        }
      }
    }
  } finally {
    try {
      if (app) {
        await session.close(app)
      }
    } finally {
      await session.dispose()
    }
  }
})
