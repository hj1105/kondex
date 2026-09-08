import { chmod, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installManagedHooks } from './managed-hook-runtime'

const tempHomes: string[] = []
const tempRoot = process.platform === 'win32' ? tmpdir() : '/tmp'
const SHELL_NAME = 'login-shell'
const SHELL_RUNS_NAME = 'login-shell-runs'

async function createTempHome(): Promise<string> {
  const home = await mkdtemp(join(tempRoot, 'orca-managed-hook-runtime-'))
  tempHomes.push(home)
  return home
}

/** Login shell that records each invocation, so an unexpected login-shell probe is observable. */
async function stubLoginShell(home: string): Promise<void> {
  const shell = join(home, SHELL_NAME)
  await writeFile(
    shell,
    `#!/bin/sh\necho ran >> "${join(home, SHELL_RUNS_NAME)}"\nexit 0\n`,
    'utf8'
  )
  await chmod(shell, 0o755)
  vi.stubEnv('HOME', home)
  vi.stubEnv('SHELL', shell)
}

afterEach(async () => {
  vi.unstubAllEnvs()
  await Promise.all(tempHomes.splice(0).map((home) => rm(home, { recursive: true, force: true })))
})

describe.runIf(process.platform !== 'win32')('installManagedHooks', () => {
  it.each([
    ['omitted', undefined],
    ['empty', { agents: [] }]
  ])(
    'writes nothing and runs no probe when the allowlist is %s (issue #11641)',
    async (_label, options) => {
      const home = await createTempHome()
      await stubLoginShell(home)

      await expect(installManagedHooks(options)).resolves.toEqual({ installers: 0, errors: 0 })

      // Why: no agent config home, no ~/.orca install lock, and no login-shell probe.
      expect(await readdir(home)).toEqual([SHELL_NAME])
    }
  )

  it('still rejects an aborted request rather than resolving an empty summary', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(
      installManagedHooks({ signal: controller.signal, agents: [] })
    ).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('installs only the allowlisted agent, under the install lock', async () => {
    const home = await createTempHome()
    await stubLoginShell(home)

    await expect(installManagedHooks({ agents: ['claude'] })).resolves.toEqual({
      installers: 1,
      errors: 0
    })

    expect((await readdir(home)).sort()).toEqual(['.claude', '.orca', SHELL_NAME])
  })
})
