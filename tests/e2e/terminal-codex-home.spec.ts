import { test, expect } from './helpers/orca-app'
import path from 'node:path'
import {
  execInTerminal,
  getTerminalContent,
  waitForActivePanePtyId,
  waitForActiveTerminalManager
} from './helpers/terminal'
import { ensureTerminalVisible, waitForActiveWorktree, waitForSessionReady } from './helpers/store'

type CodexHomeProbe = {
  codexHome: string | null
  orcaCodexHome: string | null
  home: string
}

function readCodexHomeProbe(pageContent: string, marker: string): CodexHomeProbe | null {
  const match = new RegExp(`${marker}:(\\{[^\\r\\n]+\\})`).exec(pageContent)
  if (!match) {
    return null
  }
  return JSON.parse(match[1] ?? 'null') as CodexHomeProbe | null
}

test.describe('Terminal Codex runtime home', () => {
  test.beforeEach(async ({ orcaPage }) => {
    await waitForSessionReady(orcaPage)
    await waitForActiveWorktree(orcaPage)
    await ensureTerminalVisible(orcaPage)
  })

  test('terminal process uses the platform default Codex home without escaping isolation', async ({
    orcaPage,
    electronApp
  }) => {
    await waitForActiveTerminalManager(orcaPage)
    const ptyId = await waitForActivePanePtyId(orcaPage)
    const marker = `__ORCA_CODEX_HOME_E2E_${Date.now()}__`
    const paths = await electronApp.evaluate(({ app }) => ({
      home: app.getPath('home'),
      userData: app.getPath('userData')
    }))
    // POSIX system-default accounts no longer route through the retired shared mirror.
    const expectedCodexHome =
      process.platform === 'win32' ? path.join(paths.userData, 'codex-runtime-home', 'home') : null
    const command = [
      'node -e',
      `"console.log('${marker}:' + JSON.stringify({codexHome: process.env.CODEX_HOME || null, orcaCodexHome: process.env.ORCA_CODEX_HOME || null, home: require('node:os').homedir()}))"`
    ].join(' ')

    await execInTerminal(orcaPage, ptyId, command)

    await expect
      .poll(
        async () => {
          const probe = readCodexHomeProbe(await getTerminalContent(orcaPage), marker)
          return probe
        },
        { timeout: 15_000, message: 'Terminal did not expose the isolated default Codex home' }
      )
      .toEqual({
        codexHome: expectedCodexHome,
        orcaCodexHome: expectedCodexHome,
        home: paths.home
      })
  })
})
