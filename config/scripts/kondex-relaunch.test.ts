import { describe, expect, it } from 'vitest'
import {
  KONDEX_BUNDLE_ID,
  launchCommand,
  packagedAppLocation,
  quitCommand
} from './kondex-relaunch.mjs'

describe('kondex-relaunch', () => {
  it('finds the electron-builder --dir output for each host', () => {
    expect(packagedAppLocation({ platform: 'darwin', arch: 'arm64', repoRoot: '/r' })).toEqual({
      appPath: '/r/dist/mac-arm64/Kondex.app',
      executable: '/r/dist/mac-arm64/Kondex.app/Contents/MacOS/Kondex',
      processName: 'Kondex'
    })
    expect(packagedAppLocation({ platform: 'darwin', arch: 'x64', repoRoot: '/r' }).appPath).toBe(
      '/r/dist/mac/Kondex.app'
    )
    expect(
      packagedAppLocation({ platform: 'win32', arch: 'x64', repoRoot: 'C:\\r' }).processName
    ).toBe('Kondex.exe')
    expect(packagedAppLocation({ platform: 'linux', arch: 'x64', repoRoot: '/r' }).executable).toBe(
      '/r/dist/linux-unpacked/kondex'
    )
  })

  it('quits through the app itself on macOS so the session is saved, and by name elsewhere', () => {
    expect(quitCommand({ platform: 'darwin', processName: 'Kondex' })).toEqual({
      command: 'osascript',
      args: ['-e', `tell application id "${KONDEX_BUNDLE_ID}" to quit`]
    })
    expect(quitCommand({ platform: 'win32', processName: 'Kondex.exe' })).toEqual({
      command: 'taskkill',
      args: ['/IM', 'Kondex.exe']
    })
    expect(quitCommand({ platform: 'linux', processName: 'kondex' })).toEqual({
      command: 'pkill',
      args: ['-x', 'kondex']
    })
  })

  it('opens the bundle on macOS and the executable elsewhere', () => {
    expect(
      launchCommand({ platform: 'darwin', appPath: '/r/Kondex.app', executable: '/r/Kondex.app/x' })
    ).toEqual({ command: 'open', args: ['-a', '/r/Kondex.app'] })
    expect(launchCommand({ platform: 'linux', appPath: '/r', executable: '/r/kondex' })).toEqual({
      command: '/r/kondex',
      args: []
    })
  })
})
