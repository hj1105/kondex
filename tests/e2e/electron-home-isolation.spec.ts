import type { ElectronApplication } from '@stablyai/playwright-test'
import { realpathSync } from 'node:fs'
import path from 'node:path'
import { expect, test } from './helpers/orca-app'

test.use({ seedTestRepo: false })

async function readElectronHomeState(electronApp: ElectronApplication) {
  return electronApp.evaluate(({ app }) => {
    const nodeOs = process.getBuiltinModule('node:os')
    return {
      appHome: app.getPath('home'),
      nodeHome: nodeOs.homedir(),
      userDataDir: process.env.ORCA_E2E_USER_DATA_DIR,
      home: process.env.HOME,
      userProfile: process.env.USERPROFILE,
      codexHome: process.env.CODEX_HOME,
      orcaCodexHome: process.env.ORCA_CODEX_HOME
    }
  })
}

// Codex always routes to the real home now, so this single case covers both the
// HOME boundary and that real-home routing lands inside the disposable profile.
test('isolates Electron and Codex from the developer home by default', async ({ electronApp }) => {
  const state = await readElectronHomeState(electronApp)
  // Why: macOS tmpdir is /var/... but resolves to /private/var/..., and the app
  // reports the resolved path. Compare what the paths mean, not how they spell it.
  const canonical = (value: string | undefined): string | undefined =>
    value === undefined ? undefined : realpathSync(value)
  const expectedHome = canonical(path.join(state.userDataDir!, 'home'))

  expect(canonical(state.appHome)).toBe(expectedHome)
  expect(canonical(state.nodeHome)).toBe(expectedHome)
  expect(canonical(state.home)).toBe(expectedHome)
  expect(canonical(state.userProfile)).toBe(expectedHome)
  expect(state.codexHome).toBeUndefined()
  expect(state.orcaCodexHome).toBeUndefined()
})
