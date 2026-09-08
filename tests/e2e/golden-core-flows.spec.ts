import { execFileSync } from 'node:child_process'
import { mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { ElectronApplication, Page } from '@stablyai/playwright-test'
import { test, expect } from './helpers/orca-app'
import { ensureTerminalVisible, waitForActiveWorktree, waitForSessionReady } from './helpers/store'
import {
  countVisibleTerminalPanes,
  splitActiveTerminalPane,
  waitForActiveTerminalManager,
  waitForPaneCount,
  waitForPaneIdentitySnapshot
} from './helpers/terminal'

const tempRoots: string[] = []
const SORTABLE_TAB = '[data-testid="sortable-tab"]'
test.describe.configure({ mode: 'serial' })
test.afterAll(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function createGitRepo(prefix: string, name: string): Promise<string> {
  // Why: macOS os.tmpdir() (/var/...) symlinks to /private/var/..., and the app
  // canonicalizes repo.path via `git rev-parse --show-toplevel` on add. Resolve
  // the symlink here so the path the test asserts on matches what the store holds.
  const rootPath = realpathSync(await mkdtemp(path.join(os.tmpdir(), prefix)))
  tempRoots.push(rootPath)
  const repoPath = path.join(rootPath, name)

  mkdirSync(repoPath, { recursive: true })
  execFileSync('git', ['init'], { cwd: repoPath, stdio: 'pipe' })
  execFileSync('git', ['config', 'user.email', 'e2e@test.local'], {
    cwd: repoPath,
    stdio: 'pipe'
  })
  execFileSync('git', ['config', 'user.name', 'E2E Test'], {
    cwd: repoPath,
    stdio: 'pipe'
  })
  writeFileSync(path.join(repoPath, 'README.md'), `# ${name}\n`)
  execFileSync('git', ['add', 'README.md'], { cwd: repoPath, stdio: 'pipe' })
  execFileSync('git', ['commit', '-m', 'Initial commit'], { cwd: repoPath, stdio: 'pipe' })
  execFileSync('git', ['branch', '-M', 'main'], { cwd: repoPath, stdio: 'pipe' })
  return repoPath
}

async function chooseFolderInNativeDialog(
  electronApp: ElectronApplication,
  folderPath: string
): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await electronApp.evaluate(({ dialog }, selectedPath) => {
        dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: [selectedPath],
          bookmarks: []
        })
      }, folderPath)
      return
    } catch (error) {
      if (
        attempt === 2 ||
        !(error instanceof Error) ||
        !error.message.includes('Execution context was destroyed')
      ) {
        throw error
      }
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  }
}
async function waitForRepoLoaded(page: Page, repoPath: string): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate((targetPath) => {
          const state = window.__store?.getState()
          const repo = state?.repos.find((candidate) => candidate.path === targetPath)
          if (!state || !repo) {
            return false
          }
          return (state.worktreesByRepo[repo.id] ?? []).length > 0
        }, repoPath),
      { timeout: 30_000, message: `repo did not load: ${repoPath}` }
    )
    .toBe(true)
}

async function expectProjectVisible(page: Page, repoPath: string): Promise<void> {
  const repoName = path.basename(repoPath)
  await expect(page.getByText(repoName, { exact: true }).first()).toBeVisible({ timeout: 15_000 })
}

async function addProjectFromSidebar(
  page: Page,
  electronApp: ElectronApplication,
  repoPath: string
): Promise<void> {
  await chooseFolderInNativeDialog(electronApp, repoPath)
  await page
    .getByRole('button', { name: /Add Project/i })
    .first()
    .click()
  const addDialog = page.getByRole('dialog', { name: /Add a project/i })
  await expect(addDialog).toBeVisible()
  await addDialog.getByRole('button', { name: /Browse folder/i }).click()

  const confirmDialog = page.getByRole('dialog', { name: /^Add Project$/i })
  const needsConfirmation = await confirmDialog
    .waitFor({ state: 'visible', timeout: 2_000 })
    .then(() => true)
    .catch(() => false)
  if (needsConfirmation) {
    await confirmDialog.getByRole('button', { name: /^Add Project$/ }).click()
  }

  await waitForRepoLoaded(page, repoPath)
  await expectProjectVisible(page, repoPath)
}

async function createWorkspace(page: Page, workspaceName: string): Promise<void> {
  await page.getByRole('button', { name: 'New workspace', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: /Create (Workspace|Worktree)/i })
  await expect(dialog).toBeVisible()
  const nameInput = dialog.getByPlaceholder(/Type a name/i)
  await expect(nameInput).toBeVisible()
  await nameInput.fill(workspaceName)
  await dialog.getByRole('button', { name: /Create (Workspace|Worktree)/i }).click()
  await expect(dialog).toBeHidden({ timeout: 20_000 })
  await expectActiveWorkspaceVisible(page, workspaceName)
}

async function expectActiveWorkspaceBelongsToRepo(
  page: Page,
  workspaceName: string,
  repoPath: string
): Promise<void> {
  await expectActiveWorkspaceVisible(page, workspaceName)
  await expect
    .poll(
      () =>
        page.evaluate(
          ({ targetRepoPath, targetWorkspaceName }) => {
            const state = window.__store?.getState()
            if (!state?.activeWorktreeId) {
              return null
            }
            const repo = state.repos.find((candidate) => candidate.path === targetRepoPath)
            if (!repo) {
              return null
            }
            const activeWorktree = (state.worktreesByRepo[repo.id] ?? []).find(
              (worktree) => worktree.id === state.activeWorktreeId
            )
            return activeWorktree?.displayName === targetWorkspaceName
          },
          { targetRepoPath: repoPath, targetWorkspaceName: workspaceName }
        ),
      { timeout: 20_000, message: 'active workspace did not belong to the newly added project' }
    )
    .toBe(true)
}

async function expectActiveWorkspaceVisible(page: Page, workspaceName: string): Promise<void> {
  const activeWorkspace = page
    .locator('[role="option"][aria-current="page"]')
    .filter({ hasText: new RegExp(escapeRegExp(workspaceName)) })
    .first()
  await expect(activeWorkspace).toBeVisible({ timeout: 20_000 })
}

async function countRenderedTabs(page: Page): Promise<number> {
  return page.locator(SORTABLE_TAB).count()
}

async function renderedTabIds(page: Page): Promise<string[]> {
  return page.locator(SORTABLE_TAB).evaluateAll((tabs) =>
    tabs.flatMap((tab) => {
      const tabId = tab.getAttribute('data-tab-id')
      return tabId ? [tabId] : []
    })
  )
}

async function expectTerminalSurface(page: Page): Promise<void> {
  await expect
    .poll(() => page.locator('[data-terminal-tab-id]').count(), { timeout: 30_000 })
    .toBeGreaterThan(0)
  const terminalSurface = page.locator('[data-terminal-tab-id]').first()
  await expect(terminalSurface).toHaveAttribute('data-native-file-drop-target', 'terminal')
}

async function waitForTerminalPaneManager(page: Page): Promise<void> {
  await waitForPaneCount(page, 1, 30_000)
  await waitForActiveTerminalManager(page, 30_000)
}

async function createTerminalTabThroughMenu(page: Page): Promise<void> {
  const tabIdsBefore = await renderedTabIds(page)
  await page.getByRole('button', { name: 'New tab' }).click({ force: true })
  const newTerminalMenuItem = page.getByRole('menuitem', { name: /New Terminal/i }).first()
  await newTerminalMenuItem.click({ force: true })
  await expect.poll(() => countRenderedTabs(page), { timeout: 5_000 }).toBe(tabIdsBefore.length + 1)
  const createdTabIds = (await renderedTabIds(page)).filter(
    (tabId) => !tabIdsBefore.includes(tabId)
  )
  expect(createdTabIds, 'new terminal tab should render exactly one new tab').toHaveLength(1)
  const createdTab = page.locator(`${SORTABLE_TAB}[data-tab-id="${createdTabIds[0]}"]`).first()
  await expect(createdTab).toHaveAttribute('data-tab-title', /.+/)
  await expectTerminalSurface(page)
}

async function splitTerminalPaneAndAssertIdentity(page: Page): Promise<void> {
  const paneCountBefore = await countVisibleTerminalPanes(page)
  await splitActiveTerminalPane(page, 'vertical')
  await waitForPaneCount(page, paneCountBefore + 1)
  const snapshot = await waitForPaneIdentitySnapshot(page, paneCountBefore + 1)
  expect(snapshot.panes).toHaveLength(paneCountBefore + 1)
}

test.describe('Existing-user golden core flow', () => {
  test('adds project, creates workspace, opens a terminal tab, and splits a pane', async ({
    electronApp,
    orcaPage
  }) => {
    await waitForSessionReady(orcaPage)
    await waitForActiveWorktree(orcaPage)
    const repoPath = await createGitRepo('orca-e2e-golden-existing-', 'golden-existing-project')

    await addProjectFromSidebar(orcaPage, electronApp, repoPath)
    const workspaceName = `golden-existing-${Date.now()}`
    await createWorkspace(orcaPage, workspaceName)
    await expectActiveWorkspaceBelongsToRepo(orcaPage, workspaceName, repoPath)
    await ensureTerminalVisible(orcaPage)
    await expectTerminalSurface(orcaPage)
    await waitForTerminalPaneManager(orcaPage)

    await createTerminalTabThroughMenu(orcaPage)
    await splitTerminalPaneAndAssertIdentity(orcaPage)
  })
})

test.describe('Fresh-profile golden core flow', () => {
  test.use({ dismissOnboarding: false, seedTestRepo: false })

  test('lands on Add Project, opens a terminal, and creates another workspace', async ({
    electronApp,
    orcaPage
  }) => {
    await waitForSessionReady(orcaPage)
    await expect(orcaPage.getByRole('heading', { name: 'KONDEX' })).toBeVisible({
      timeout: 15_000
    })
    await expect(orcaPage.getByText('Add a project to get started.')).toBeVisible()

    const repoPath = await createGitRepo('orca-e2e-golden-new-', 'golden-new-project')
    await chooseFolderInNativeDialog(electronApp, repoPath)
    await orcaPage.getByRole('button', { name: /Add Project/i }).click()
    const addProjectDialog = orcaPage.getByRole('dialog', { name: /Add a project/i })
    await expect(addProjectDialog).toBeVisible()
    await orcaPage
      .getByRole('button', { name: /Browse for a folder|Open a folder|Browse folder/i })
      .click()
    await waitForRepoLoaded(orcaPage, repoPath)
    await expectProjectVisible(orcaPage, repoPath)
    await waitForActiveWorktree(orcaPage)
    await ensureTerminalVisible(orcaPage)
    await expectTerminalSurface(orcaPage)
    await waitForTerminalPaneManager(orcaPage)

    await splitTerminalPaneAndAssertIdentity(orcaPage)

    const workspaceName = `golden-new-${Date.now()}`
    await createWorkspace(orcaPage, workspaceName)
    await expectActiveWorkspaceBelongsToRepo(orcaPage, workspaceName, repoPath)
  })
})
