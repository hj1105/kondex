import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { join } from 'node:path'
import {
  resolveMacOSComputerUseAppPath,
  resolveMacOSComputerUseExecutablePath
} from './macos-native-provider-paths'

const existing = vi.hoisted(() => new Set<string>())
vi.mock('node:fs', () => ({ existsSync: (value: string) => existing.has(value) }))

describe('Kondex computer helper paths', () => {
  beforeEach(() => {
    existing.clear()
    vi.stubGlobal('process', {
      ...process,
      resourcesPath: '/packaged/resources',
      env: { ...process.env, ORCA_COMPUTER_MACOS_HELPER_APP_PATH: undefined }
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('resolves the packaged Kondex helper and its retained internal executable', () => {
    const app = join(process.resourcesPath, 'Kondex Computer Use.app')
    const executable = join(app, 'Contents', 'MacOS', 'orca-computer-use-macos')
    existing.add(app)
    existing.add(executable)
    expect(resolveMacOSComputerUseAppPath()).toBe(app)
    expect(resolveMacOSComputerUseExecutablePath()).toBe(executable)
  })

  it('resolves the developer build when no packaged helper exists', () => {
    const app = join(
      process.cwd(),
      'native/computer-use-macos/.build/release/Kondex Computer Use.app'
    )
    existing.add(app)
    expect(resolveMacOSComputerUseAppPath()).toBe(app)
    expect(resolveMacOSComputerUseExecutablePath()).toBeNull()
  })

  it('does not silently borrow the upstream helper identity', () => {
    existing.add(join(process.resourcesPath, 'Orca Computer Use.app'))
    existing.add(
      join(process.cwd(), 'native/computer-use-macos/.build/release/Orca Computer Use.app')
    )
    expect(resolveMacOSComputerUseAppPath()).toBeNull()
  })

  it('preserves the explicit helper override', () => {
    const app = join('/explicit', 'Test Helper.app')
    process.env.ORCA_COMPUTER_MACOS_HELPER_APP_PATH = app
    existing.add(app)
    expect(resolveMacOSComputerUseAppPath()).toBe(app)
  })
})
