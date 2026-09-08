import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  handleMock,
  discoverSkillsMock,
  discoverSkillsInWslMock,
  inventorySkillFreshnessMock,
  getDefaultWslDistroMock,
  getWslHomeMock,
  parseWslPathMock
} = vi.hoisted(() => ({
  handleMock: vi.fn(),
  discoverSkillsMock: vi.fn(),
  discoverSkillsInWslMock: vi.fn(),
  inventorySkillFreshnessMock: vi.fn(),
  getDefaultWslDistroMock: vi.fn(),
  getWslHomeMock: vi.fn(),
  parseWslPathMock: vi.fn()
}))
const nativeUpdate = vi.hoisted(() => ({ mutate: vi.fn(), registrations: vi.fn() }))
vi.mock('../skills/bundled-agent-skill-install', () => ({
  mutateBundledAgentSkills: nativeUpdate.mutate
}))
vi.mock('../skills/bundled-skill-update-registration', () => ({
  readBundledSkillUpdateRegistrations: nativeUpdate.registrations
}))

vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows: () => [] },
  app: {
    getVersion: () => '9.9.9-test',
    getPath: () => '/tmp/kondex-test-profile'
  },
  ipcMain: {
    handle: handleMock
  }
}))

vi.mock('./skill-ipc-main-window', () => ({
  handleMainWindowSkillIpc: (channel: string, handler: unknown) => handleMock(channel, handler)
}))

vi.mock('../skills/discovery', () => ({
  discoverSkills: discoverSkillsMock,
  clearSkillRootScanCache: vi.fn()
}))

vi.mock('../skills/skill-discovery-wsl', () => ({
  discoverSkillsInWsl: discoverSkillsInWslMock
}))

vi.mock('../skills/skill-freshness-inventory', () => ({
  inventorySkillFreshness: inventorySkillFreshnessMock
}))

vi.mock('../wsl', () => ({
  getDefaultWslDistro: getDefaultWslDistroMock,
  getWslHome: getWslHomeMock,
  parseWslPath: parseWslPathMock,
  toLinuxPath: (pathValue: string) => {
    if (pathValue === '\\\\wsl.localhost\\Ubuntu\\home\\alice') {
      return '/home/alice'
    }
    if (pathValue === 'C:\\repo\\worktree') {
      return '/mnt/c/repo/worktree'
    }
    return pathValue
  }
}))

import { registerSkillsHandlers } from './skills'

describe('registerSkillsHandlers', () => {
  const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')
  const repos = [{ id: 'repo-1', path: 'C:\\Users\\alice\\repo' }]
  const store = {
    getRepos: vi.fn(() => repos)
  }

  beforeEach(() => {
    handleMock.mockReset()
    nativeUpdate.mutate.mockReset()
    nativeUpdate.registrations.mockReset()
    discoverSkillsMock.mockReset()
    discoverSkillsInWslMock.mockReset()
    getDefaultWslDistroMock.mockReset()
    getWslHomeMock.mockReset()
    parseWslPathMock.mockReset()
    parseWslPathMock.mockReturnValue(null)
    discoverSkillsMock.mockResolvedValue({ skills: [], sources: [], scannedAt: 1 })
    discoverSkillsInWslMock.mockResolvedValue({ skills: [], sources: [], scannedAt: 1 })
    inventorySkillFreshnessMock.mockResolvedValue({
      schemaVersion: 1,
      installations: [],
      eligibleUpdateNames: [],
      scanIssues: [],
      scannedAt: 1
    })
    getWslHomeMock.mockReturnValue('\\\\wsl.localhost\\Ubuntu\\home\\alice')
    Object.defineProperty(process, 'platform', {
      configurable: true,
      value: 'win32'
    })
  })

  afterEach(() => {
    if (originalPlatform) {
      Object.defineProperty(process, 'platform', originalPlatform)
    }
  })

  function getDiscoverHandler() {
    registerSkillsHandlers(store as never)
    const call = handleMock.mock.calls.find((entry: unknown[]) => entry[0] === 'skills:discover')
    if (!call) {
      throw new Error('skills:discover handler was not registered')
    }
    return call[1] as (_event: unknown, target?: unknown) => Promise<unknown>
  }

  function getFreshnessHandler() {
    registerSkillsHandlers(store as never)
    const call = handleMock.mock.calls.find(
      (entry: unknown[]) => entry[0] === 'skills:freshnessInventory'
    )
    if (!call) {
      throw new Error('skills:freshnessInventory handler was not registered')
    }
    return call[1] as (_event: unknown) => Promise<unknown>
  }

  it('uses host skill discovery when resolved project runtime overrides stale WSL target state', async () => {
    const handler = getDiscoverHandler()

    await handler(null, {
      runtime: 'wsl',
      wslDistro: 'Debian',
      projectRuntime: {
        status: 'resolved',
        runtime: {
          kind: 'windows-host',
          hostPlatform: 'win32',
          projectId: 'repo-1',
          reason: 'project-override',
          cacheKey: 'repo-1:windows-host'
        }
      }
    })

    expect(discoverSkillsMock).toHaveBeenCalledWith({ repos, refresh: false })
    expect(getWslHomeMock).not.toHaveBeenCalled()
  })

  it('scopes host skill discovery to the active workspace cwd when provided', async () => {
    const handler = getDiscoverHandler()

    await handler(null, { cwd: '/repo/worktree' })

    expect(discoverSkillsMock).toHaveBeenCalledWith({
      repos: [],
      cwd: '/repo/worktree',
      refresh: false
    })
  })

  it('uses the selected project WSL distro for skill discovery', async () => {
    const handler = getDiscoverHandler()

    await handler(null, {
      projectRuntime: {
        status: 'resolved',
        runtime: {
          kind: 'wsl',
          hostPlatform: 'wsl',
          projectId: 'repo-1',
          distro: 'Ubuntu',
          reason: 'project-override',
          cacheKey: 'repo-1:wsl:Ubuntu'
        }
      }
    })

    expect(getDefaultWslDistroMock).not.toHaveBeenCalled()
    expect(getWslHomeMock).toHaveBeenCalledWith('Ubuntu')
    expect(discoverSkillsInWslMock).toHaveBeenCalledWith({
      distro: 'Ubuntu',
      homeDir: '/home/alice',
      cwd: '/home/alice'
    })
  })

  it('scans the requested project directory in the selected WSL runtime', async () => {
    const handler = getDiscoverHandler()

    await handler(null, {
      cwd: 'C:\\repo\\worktree',
      projectRuntime: {
        status: 'resolved',
        runtime: {
          kind: 'wsl',
          hostPlatform: 'wsl',
          projectId: 'repo-1',
          distro: 'Ubuntu',
          reason: 'project-override',
          cacheKey: 'repo-1:wsl:Ubuntu'
        }
      }
    })

    expect(discoverSkillsInWslMock).toHaveBeenCalledWith({
      distro: 'Ubuntu',
      homeDir: '/home/alice',
      cwd: '/mnt/c/repo/worktree'
    })
  })

  it('blocks skill discovery when project runtime requires repair', async () => {
    const handler = getDiscoverHandler()

    await expect(
      handler(null, {
        projectRuntime: {
          status: 'repair-required',
          repair: {
            projectId: 'repo-1',
            preferredRuntime: { kind: 'wsl', distro: 'Ubuntu' },
            reason: 'wsl-distro-missing',
            source: 'project-override',
            cacheKey: 'repo-1:repair:wsl-distro-missing:Ubuntu'
          }
        }
      })
    ).rejects.toThrow('Project runtime requires repair before skill discovery')
    expect(discoverSkillsMock).not.toHaveBeenCalled()
  })

  it('keeps freshness inventory local and read-only over known repositories', async () => {
    const handler = getFreshnessHandler()

    await handler(null)

    expect(inventorySkillFreshnessMock).toHaveBeenCalledWith({
      currentAppVersion: '9.9.9-test',
      stateDirectory: '/tmp/kondex-test-profile',
      repos
    })
    expect(getWslHomeMock).not.toHaveBeenCalled()
  })
  it('updates only supported built-in names through the native profile-owned transaction', async () => {
    registerSkillsHandlers(store as never)
    const handler = (name: string) =>
      handleMock.mock.calls.find((call) => call[0] === name)![1] as (
        ...args: unknown[]
      ) => Promise<unknown>
    const start = handler('skills:startUpdateRun')
    const state = handler('skills:getUpdateRun')
    expect(await start(null, ['orca-cli'])).toEqual({ started: false, reason: 'invalid-names' })
    expect(await start(null, ['kondex-unknown'])).toEqual({
      started: false,
      reason: 'invalid-names'
    })
    expect(nativeUpdate.mutate).not.toHaveBeenCalled()
    nativeUpdate.mutate.mockResolvedValue({
      status: 'complete',
      skippedSkills: [],
      skills: [{ name: 'kondex-cli', status: 'unchanged' }]
    })
    nativeUpdate.registrations.mockResolvedValue(new Map([['kondex-cli', {}]]))
    inventorySkillFreshnessMock.mockResolvedValue({
      installations: [{ name: 'kondex-cli', topology: 'canonical-copy', status: 'current' }]
    })
    expect(await start(null, ['kondex-cli'])).toEqual({ started: true })
    await vi.waitFor(async () => expect(await state(null)).toMatchObject({ state: 'success' }))
    expect(nativeUpdate.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        verb: 'update',
        skillNames: ['kondex-cli'],
        scope: 'global',
        stateDirectory: '/tmp/kondex-test-profile',
        providers: [],
        signal: expect.any(AbortSignal)
      })
    )
  })
  it.each(['newer-known', 'unrecognized', 'inaccessible'])(
    'does not write a %s installation even if a caller bypasses the UI',
    async (status) => {
      registerSkillsHandlers(store as never)
      const start = handleMock.mock.calls.find((call) => call[0] === 'skills:startUpdateRun')![1]
      const state = handleMock.mock.calls.find((call) => call[0] === 'skills:getUpdateRun')![1]
      nativeUpdate.registrations.mockResolvedValue(new Map([['kondex-cli', {}]]))
      inventorySkillFreshnessMock.mockResolvedValue({
        installations: [{ name: 'kondex-cli', topology: 'canonical-copy', status }]
      })
      await start(null, ['kondex-cli'])
      await vi.waitFor(async () =>
        expect(await state(null)).toMatchObject({ state: 'error', failedNames: ['kondex-cli'] })
      )
      expect(nativeUpdate.mutate).not.toHaveBeenCalled()
    }
  )
})
