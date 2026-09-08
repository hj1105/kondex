import type { ElectronApplication, Page } from '@stablyai/playwright-test'
import { test, expect } from './helpers/orca-app'
import { waitForSessionReady } from './helpers/store'
import type {
  DiscoveredSkill,
  SkillDiscoveryResult,
  SkillSourceKind
} from '../../src/shared/skills'
import { ORCHESTRATION_ENABLED_STORAGE_KEY } from '../../src/renderer/src/lib/orchestration-setup-state'
import { ORCHESTRATION_SKILL_NAME } from '../../src/shared/agent-feature-install-commands'

type MockSkillDiscoveryGlobal = typeof globalThis & {
  __orcaSettingsSkillDiscoveryResult?: SkillDiscoveryResult
}

function makeSkill(sourceKind: SkillSourceKind, directoryPath: string): DiscoveredSkill {
  return {
    id: `${sourceKind}-orca-cli`,
    name: ORCHESTRATION_SKILL_NAME,
    description: null,
    providers: ['agent-skills'],
    sourceKind,
    sourceLabel: sourceKind,
    rootPath: directoryPath.slice(0, directoryPath.lastIndexOf('/')),
    directoryPath,
    skillFilePath: `${directoryPath}/SKILL.md`,
    installed: true,
    updatedAt: null
  }
}

function discoveryResult(skills: DiscoveredSkill[]): SkillDiscoveryResult {
  return {
    skills,
    sources: [],
    scannedAt: Date.now()
  }
}

async function installMockSkillDiscovery(
  app: ElectronApplication,
  result: SkillDiscoveryResult
): Promise<void> {
  await app.evaluate((electron, initialResult) => {
    const global = globalThis as MockSkillDiscoveryGlobal
    global.__orcaSettingsSkillDiscoveryResult = initialResult
    electron.ipcMain.removeHandler('skills:discover')
    electron.ipcMain.handle('skills:discover', () => {
      const latest = (globalThis as MockSkillDiscoveryGlobal).__orcaSettingsSkillDiscoveryResult
      if (!latest) {
        throw new Error('Missing mocked skill discovery result')
      }
      return latest
    })
  }, result)
}

async function setMockSkillDiscovery(
  app: ElectronApplication,
  result: SkillDiscoveryResult
): Promise<void> {
  await app.evaluate((_, nextResult) => {
    ;(globalThis as MockSkillDiscoveryGlobal).__orcaSettingsSkillDiscoveryResult = nextResult
  }, result)
}

async function openOrchestrationSettings(page: Page): Promise<void> {
  await page.evaluate(
    ({ enabledKey }) => {
      localStorage.removeItem(enabledKey)
      const state = window.__store!.getState()
      state.setSettingsSearchQuery('orchestration')
      state.openSettingsPage()
    },
    {
      enabledKey: ORCHESTRATION_ENABLED_STORAGE_KEY
    }
  )
  await expect(page.getByPlaceholder('Search settings')).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: /^Orchestration\b/ }).click()
  await expect(
    page
      .locator('[data-settings-section="orchestration"]')
      .getByRole('heading', { name: 'Orchestration', exact: true })
  ).toBeInViewport({ timeout: 10_000 })
}

test.describe('Settings skill detection', () => {
  test.beforeEach(async ({ orcaPage }) => {
    await waitForSessionReady(orcaPage)
  })

  test('shows installed only for global orchestration skill installs', async ({
    electronApp,
    orcaPage
  }) => {
    await installMockSkillDiscovery(
      electronApp,
      discoveryResult([
        makeSkill('repo', `/workspace/.agents/skills/${ORCHESTRATION_SKILL_NAME}`),
        makeSkill('plugin', `/Users/test/.codex/plugins/cache/vendor/${ORCHESTRATION_SKILL_NAME}`)
      ])
    )

    await openOrchestrationSettings(orcaPage)
    const section = orcaPage.locator('[data-settings-section="orchestration"]')
    await section.getByRole('button', { name: 'Re-check' }).click()

    await expect(section.getByText('Not installed', { exact: true })).toBeVisible()
    await expect(
      section.getByText('Enables agents to hand off context and coordinate work through Kondex.')
    ).toBeVisible()

    await setMockSkillDiscovery(
      electronApp,
      discoveryResult([makeSkill('home', `/Users/test/.agents/skills/${ORCHESTRATION_SKILL_NAME}`)])
    )
    await section.getByRole('button', { name: 'Re-check' }).click()

    await expect(section.getByText('Installed', { exact: true })).toBeVisible()
    await expect(
      section.getByText('Enables agents to hand off context and coordinate work through Kondex.')
    ).toBeVisible()
  })
})
