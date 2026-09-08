import { EventEmitter } from 'node:events'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { spawnMock, spawnSyncMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
  spawnSyncMock: vi.fn()
}))

vi.mock('child_process', () => ({
  spawn: spawnMock,
  spawnSync: spawnSyncMock
}))

import { launchOrcaApp, serveOrcaApp } from './launch'

class FakeChildProcess extends EventEmitter {
  stdout = new EventEmitter()
  kill = vi.fn()
  unref = vi.fn()
  pid = 4101
}

describe('serveOrcaApp', () => {
  const temporaryDirectories: string[] = []

  beforeEach(() => {
    spawnMock.mockReset()
    spawnSyncMock.mockReset()
    process.env.ORCA_APP_EXECUTABLE = '/Applications/Orca.app/Contents/MacOS/Orca'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.ORCA_APP_EXECUTABLE
    delete process.env.ORCA_APP_EXECUTABLE_NEEDS_APP_ROOT
    delete process.env.ORCA_USER_DATA_PATH
    return Promise.all(
      temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true }))
    )
  })

  it('pins the Electron child cwd to the app root instead of the caller cwd', async () => {
    const child = {
      kill: vi.fn(),
      once: vi.fn(
        (event: string, handler: (code: number | null, signal: string | null) => void) => {
          if (event === 'exit') {
            queueMicrotask(() => handler(0, null))
          }
          return child
        }
      )
    }
    spawnMock.mockReturnValue(child)

    await expect(serveOrcaApp({ json: true })).resolves.toBe(0)

    expect(spawnMock).toHaveBeenCalledWith(
      '/Applications/Orca.app/Contents/MacOS/Orca',
      ['--serve', '--serve-json'],
      expect.objectContaining({
        cwd: resolve(__dirname, '../../..')
      })
    )
  })

  it('passes the app root before serve flags for dev Electron executables', async () => {
    process.env.ORCA_APP_EXECUTABLE = '/repo/node_modules/.bin/electron'
    process.env.ORCA_APP_EXECUTABLE_NEEDS_APP_ROOT = '1'
    const child = {
      kill: vi.fn(),
      once: vi.fn(
        (event: string, handler: (code: number | null, signal: string | null) => void) => {
          if (event === 'exit') {
            queueMicrotask(() => handler(0, null))
          }
          return child
        }
      )
    }
    spawnMock.mockReturnValue(child)

    await expect(serveOrcaApp({ json: true, port: '6768' })).resolves.toBe(0)

    expect(spawnMock).toHaveBeenCalledWith(
      '/repo/node_modules/.bin/electron',
      [resolve(__dirname, '../../..'), '--serve', '--serve-json', '--serve-port', '6768'],
      expect.objectContaining({
        cwd: resolve(__dirname, '../../..')
      })
    )
  })

  it.each([
    { probe: 'exits nonzero', result: { status: 1 }, expectedPrefix: ['--no-sandbox'] },
    { probe: 'succeeds', result: { status: 0 }, expectedPrefix: [] },
    {
      probe: 'times out',
      result: {
        status: null,
        error: Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' })
      },
      expectedPrefix: ['--no-sandbox']
    },
    {
      probe: 'cannot start',
      result: { status: null, error: Object.assign(new Error('missing'), { code: 'ENOENT' }) },
      expectedPrefix: ['--no-sandbox']
    }
  ])(
    'uses the extracted AppImage sandbox fallback when the userns probe $probe',
    async ({ result: userNamespaceResult, expectedPrefix }) => {
      const platformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform')
      const getuidDescriptor = Object.getOwnPropertyDescriptor(process, 'getuid')
      const root = await mkdtemp(join(tmpdir(), 'orca-extracted-appimage-'))
      temporaryDirectories.push(root)
      const executable = join(root, 'orca-ide')
      await writeFile(join(root, 'AppRun'), '', { mode: 0o755 })
      process.env.ORCA_APP_EXECUTABLE = executable
      Object.defineProperty(process, 'platform', { value: 'linux' })
      Object.defineProperty(process, 'getuid', { configurable: true, value: () => 1000 })
      spawnSyncMock.mockReturnValue(userNamespaceResult)
      const child = new FakeChildProcess()
      spawnMock.mockReturnValue(child)

      try {
        const result = serveOrcaApp({ json: true })
        queueMicrotask(() => child.emit('exit', 0, null))
        await expect(result).resolves.toBe(0)
        expect(spawnSyncMock).toHaveBeenCalledWith(
          'unshare',
          ['-Ur', 'true'],
          expect.objectContaining({ stdio: 'ignore', timeout: 2_000 })
        )
        expect(spawnMock).toHaveBeenCalledWith(
          executable,
          [...expectedPrefix, '--serve', '--serve-json'],
          // Foreground serve must share POSIX job-control signals with its CLI supervisor.
          expect.objectContaining({ detached: false })
        )
      } finally {
        if (platformDescriptor) {
          Object.defineProperty(process, 'platform', platformDescriptor)
        }
        if (getuidDescriptor) {
          Object.defineProperty(process, 'getuid', getuidDescriptor)
        } else {
          Reflect.deleteProperty(process, 'getuid')
        }
      }
    }
  )

  it('uses a shell when a Windows npm command shim is the Electron executable', async () => {
    const platformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform')
    Object.defineProperty(process, 'platform', { value: 'win32' })
    process.env.ORCA_APP_EXECUTABLE = 'C:\\repo\\node_modules\\.bin\\electron.cmd'
    const child = {
      kill: vi.fn(),
      once: vi.fn(
        (event: string, handler: (code: number | null, signal: string | null) => void) => {
          if (event === 'exit') {
            queueMicrotask(() => handler(0, null))
          }
          return child
        }
      )
    }
    spawnMock.mockReturnValue(child)

    try {
      await expect(serveOrcaApp({ json: true })).resolves.toBe(0)
      expect(spawnMock).toHaveBeenCalledWith(
        'C:\\repo\\node_modules\\.bin\\electron.cmd',
        ['--serve', '--serve-json'],
        expect.objectContaining({
          shell: true
        })
      )
    } finally {
      if (platformDescriptor) {
        Object.defineProperty(process, 'platform', platformDescriptor)
      }
    }
  })
})

describe('launchOrcaApp', () => {
  beforeEach(() => {
    spawnMock.mockReset()
    spawnSyncMock.mockReset()
  })

  afterEach(() => {
    delete process.env.ORCA_OPEN_COMMAND
    delete process.env.ORCA_APP_EXECUTABLE
    delete process.env.ORCA_APP_EXECUTABLE_NEEDS_APP_ROOT
  })

  it('handles asynchronous detached spawn errors without throwing', async () => {
    process.env.ORCA_APP_EXECUTABLE = '/missing/Orca'
    const child = new FakeChildProcess()
    spawnMock.mockReturnValue(child)

    launchOrcaApp()
    child.emit('error', new Error('ENOENT'))
    await Promise.resolve()

    expect(child.unref).toHaveBeenCalled()
  })

  it('adds the extracted-AppImage sandbox fallback for open launches', async () => {
    const platformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform')
    const getuidDescriptor = Object.getOwnPropertyDescriptor(process, 'getuid')
    const root = await mkdtemp(join(tmpdir(), 'orca-open-extracted-appimage-'))
    const executable = join(root, 'orca-ide')

    try {
      await writeFile(join(root, 'AppRun'), '')
      process.env.ORCA_APP_EXECUTABLE = executable
      process.env.ELECTRON_RUN_AS_NODE = '1'
      Object.defineProperty(process, 'platform', { configurable: true, value: 'linux' })
      Object.defineProperty(process, 'getuid', { configurable: true, value: () => 1000 })
      spawnSyncMock.mockReturnValue({ status: 1 })
      const child = new FakeChildProcess()
      spawnMock.mockReturnValue(child)

      launchOrcaApp()

      expect(spawnSyncMock).toHaveBeenCalledWith(
        'unshare',
        ['-Ur', 'true'],
        expect.objectContaining({ stdio: 'ignore', timeout: 2_000 })
      )
      expect(spawnMock).toHaveBeenCalledWith(
        executable,
        ['--no-sandbox'],
        expect.objectContaining({
          detached: true,
          stdio: 'ignore',
          env: expect.not.objectContaining({ ELECTRON_RUN_AS_NODE: '1' })
        })
      )
      expect(child.unref).toHaveBeenCalledOnce()
    } finally {
      await rm(root, { recursive: true, force: true })
      delete process.env.ELECTRON_RUN_AS_NODE
      if (platformDescriptor) {
        Object.defineProperty(process, 'platform', platformDescriptor)
      }
      if (getuidDescriptor) {
        Object.defineProperty(process, 'getuid', getuidDescriptor)
      } else {
        Reflect.deleteProperty(process, 'getuid')
      }
    }
  })
})
