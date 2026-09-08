import { mkdir, mkdtemp, readFile, readlink, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CliInstaller } from './cli-installer'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

async function fixture(isPackaged = true) {
  const root = await mkdtemp(join(tmpdir(), 'kondex-cli-coexistence-'))
  roots.push(root)
  const homePath = join(root, 'home')
  const commandDirectory = join(homePath, '.local', 'bin')
  const resourcesPath = join(root, 'resources')
  const userDataPath = join(root, 'profile')
  const appPath = join(root, 'app')
  await mkdir(commandDirectory, { recursive: true })
  await mkdir(join(resourcesPath, 'bin'), { recursive: true })
  await mkdir(join(appPath, 'out', 'cli'), { recursive: true })
  await writeFile(join(resourcesPath, 'bin', 'kondex'), '#!/bin/sh\n', { mode: 0o755 })
  await writeFile(join(appPath, 'out', 'cli', 'index.js'), '')
  const installer = new CliInstaller({
    platform: 'linux',
    isPackaged,
    homePath,
    resourcesPath,
    userDataPath,
    appPath,
    execPath: '/opt/Kondex/kondex',
    appImagePath: null,
    processPathEnv: commandDirectory
  })
  return { installer, commandDirectory, resourcesPath, userDataPath }
}

describe.skipIf(process.platform === 'win32')('Kondex CLI coexistence', () => {
  it.each(['install', 'remove'] as const)(
    '%s leaves upstream command names untouched',
    async (action) => {
      const { installer, commandDirectory, resourcesPath } = await fixture()
      const oldLauncher = join(resourcesPath, 'bin', 'orca')
      await writeFile(oldLauncher, '#!/bin/sh\necho upstream\n', { mode: 0o755 })
      await symlink(oldLauncher, join(commandDirectory, 'orca'))
      for (const command of ['codex', 'orca-dev', 'orca-ide']) {
        await writeFile(join(commandDirectory, command), command, { mode: 0o755 })
      }

      await installer[action]()
      if (action === 'install') {
        await installer.remove()
      }

      expect(await readlink(join(commandDirectory, 'orca'))).toBe(oldLauncher)
      for (const command of ['codex', 'orca-dev', 'orca-ide']) {
        expect(await readFile(join(commandDirectory, command), 'utf8')).toBe(command)
      }
    }
  )

  it('creates a Kondex dev alias without overwriting an existing orca alias', async () => {
    const { installer, userDataPath } = await fixture(false)
    const bin = join(userDataPath, 'cli', 'bin')
    await mkdir(bin, { recursive: true })
    await writeFile(join(bin, 'orca'), 'existing upstream alias')

    await installer.install()

    expect(await readFile(join(bin, 'orca'), 'utf8')).toBe('existing upstream alias')
    expect(await readFile(join(bin, 'kondex'), 'utf8')).toBe(
      await readFile(join(bin, 'kondex-dev'), 'utf8')
    )
  })

  it.each([
    ['/opt/Kondex/resources/bin/kondex', 'stale'],
    ['/opt/kondex/resources/bin/kondex', 'stale'],
    ['/opt/Orca/resources/bin/kondex', 'conflict'],
    ['/opt/orca-ide/resources/bin/kondex', 'conflict']
  ])('classifies ownership of %s as %s', async (target, state) => {
    const { installer, commandDirectory } = await fixture()
    await symlink(target, join(commandDirectory, 'kondex'))
    expect(await installer.getStatus()).toMatchObject({ state, currentTarget: target })
  })
})
