import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  buildLinuxElectronBuilderArgs,
  resolveLinuxBuildArch,
  runLocalLinuxBuild
} from './build-linux-local.mjs'

describe('local Linux build target', () => {
  it('is the package script used by the local Linux build', () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(import.meta.dirname, '../../package.json'), 'utf8')
    )
    expect(packageJson.scripts['build:linux']).toContain(
      'node config/scripts/build-linux-local.mjs'
    )
  })

  it('follows a native Linux host architecture', () => {
    expect(resolveLinuxBuildArch({ platform: 'linux', hostArch: 'arm64' })).toBe('arm64')
    expect(resolveLinuxBuildArch({ platform: 'linux', hostArch: 'x64' })).toBe('x64')
  })

  it('defaults cross-platform Linux builds to x64 and allows an explicit override', () => {
    expect(resolveLinuxBuildArch({ platform: 'darwin', hostArch: 'arm64' })).toBe('x64')
    expect(
      resolveLinuxBuildArch({ platform: 'darwin', hostArch: 'arm64', requestedArch: 'arm64' })
    ).toBe('arm64')
  })

  it('rejects unsupported architectures', () => {
    expect(() => resolveLinuxBuildArch({ platform: 'linux', hostArch: 'ia32' })).toThrow(
      'Unsupported Linux build architecture'
    )
    expect(() => buildLinuxElectronBuilderArgs('ia32')).toThrow(
      'Unsupported Linux build architecture'
    )
  })

  it('passes an explicit target and preserves the local build environment', () => {
    const execFile = vi.fn()
    runLocalLinuxBuild({
      arch: 'arm64',
      environment: { PATH: '/bin' },
      execFile,
      platform: 'linux',
      cwd: '/workspace'
    })
    expect(execFile).toHaveBeenCalledWith(
      'pnpm',
      buildLinuxElectronBuilderArgs('arm64'),
      expect.objectContaining({
        cwd: '/workspace',
        env: { PATH: '/bin' },
        stdio: 'inherit'
      })
    )

    expect(buildLinuxElectronBuilderArgs('x64')).toEqual(
      expect.arrayContaining(['--linux', 'AppImage', 'deb', 'rpm', '--x64'])
    )
  })

  it('uses the Windows pnpm command name when cross-host packaging', () => {
    const execFile = vi.fn()
    runLocalLinuxBuild({ arch: 'x64', execFile, platform: 'win32', cwd: 'C:\\workspace' })
    expect(execFile.mock.calls[0]?.[0]).toBe('pnpm.cmd')
  })
})
