import { expect, type Page } from '@stablyai/playwright-test'

/**
 * Waits until a command the test started owns the terminal, not the shell.
 * `hasChildProcesses` alone is not enough: macOS starts the shell under `login`,
 * so a still-initialising terminal already reports a child.
 *
 * Two signals, because only one is available per platform. node-pty names the
 * foreground process on Linux but leaves it empty on macOS, where the POSIX fence
 * still reports a foreground process group distinct from the shell's own pid.
 */
export async function waitForForegroundChild(
  page: Page,
  ptyId: string,
  processName: string,
  timeoutMs = 20_000
): Promise<void> {
  await expect
    .poll(
      async () => {
        const info = await page.evaluate((id) => window.api.pty.inspectProcess(id), ptyId)
        if (info.foregroundProcess === processName) {
          return true
        }
        const evidence = info.foregroundProcessEvidence
        const fence = evidence && 'fence' in evidence ? evidence.fence : null
        return fence?.platform === 'posix' && fence.foregroundPgid !== fence.shellPid
      },
      { timeout: timeoutMs, message: `${processName} never took the terminal foreground` }
    )
    .toBe(true)
}
