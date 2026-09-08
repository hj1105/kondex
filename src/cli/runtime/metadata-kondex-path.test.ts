import { afterEach, describe, expect, it, vi } from 'vitest'
import { join } from 'node:path'
import { getDefaultUserDataPath } from './metadata'

afterEach(() => vi.unstubAllEnvs())
describe('Kondex CLI profile isolation', () => {
  it.each(['darwin', 'linux', 'win32'] as const)(
    'does not use the Orca default on %s',
    (platform) => {
      vi.stubEnv('ORCA_USER_DATA_PATH', '')
      vi.stubEnv('XDG_CONFIG_HOME', '/fixture/config')
      vi.stubEnv('APPDATA', '/fixture/appdata')
      expect(getDefaultUserDataPath(platform, '/fixture/home')).toBe(
        platform === 'darwin'
          ? join('/fixture/home', 'Library', 'Application Support', 'kondex')
          : platform === 'linux'
            ? join('/fixture/config', 'kondex')
            : join('/fixture/appdata', 'kondex')
      )
    }
  )
  it('retains an explicitly selected profile', () => {
    vi.stubEnv('ORCA_USER_DATA_PATH', '/fixture/kondex-dev')
    expect(getDefaultUserDataPath()).toBe('/fixture/kondex-dev')
  })
})
