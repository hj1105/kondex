import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getOrcaElectronLaunchArgs } from './electron-launch-args'

describe('getOrcaElectronLaunchArgs', () => {
  it('launches the package root that owns the compiled main entry', () => {
    const root = join('workspace', 'orca')
    const mainPath = join(root, 'out', 'main', 'index.js')

    const args = getOrcaElectronLaunchArgs(mainPath, true)
    expect(args.at(-1)).toBe(root)
    if (process.platform === 'darwin') {
      expect(args.slice(0, -1)).toEqual([
        '--lang=en-US',
        '--password-store=basic',
        '--use-mock-keychain'
      ])
    }
    expect(getOrcaElectronLaunchArgs(mainPath, false).at(-1)).toBe(root)
    // The suite asserts English labels, so every launch path must pin the locale.
    expect(getOrcaElectronLaunchArgs(mainPath, false)).toContain('--lang=en-US')
  })
})
