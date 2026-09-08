import { readFile, stat } from 'node:fs/promises'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeSkillCommandHost } from './runtime-skill-command-contract'
import type { BundledSkillInstallRequest } from '../../shared/bundled-skill-install-contract'

const mocks = vi.hoisted(() => ({ execute: vi.fn(), ssh: vi.fn() }))
vi.mock('../skills/skill-bundle-install-request-service', () => ({
  executeSkillBundleInstallRequest: mocks.execute
}))
vi.mock('../skills/skill-bundle-ssh-relay-service', () => ({
  installSkillBundleOnSshHost: mocks.ssh
}))
import { RuntimeSkillInstallCommands } from './runtime-skill-install-commands'

function host(): RuntimeSkillCommandHost {
  return {
    getRuntimeId: () => 'runtime-1',
    getUserDataPath: () => '/unused-state',
    isPackaged: () => true,
    listRepos: () => [],
    listFolderWorkspaces: () => [{ id: 'folder-1', folderPath: '/fixture-folder' }],
    listResolvedWorktrees: async () => [],
    showManagedWorktree: async () => {
      throw new Error('unused')
    },
    getSshProvider: () => ({ requestHostRpc: vi.fn() }) as never,
    skillTransactionRecovery: Promise.resolve()
  }
}
function request(): BundledSkillInstallRequest {
  return {
    operationId: 'bundled-test',
    skillNames: ['computer-use'],
    providers: ['codex'],
    destination: { scope: 'global', executionTarget: { kind: 'host' } }
  }
}
beforeEach(() => {
  vi.resetAllMocks()
})

describe('runtime-owned bundled skill installation', () => {
  it.each([
    { scope: 'global', executionTarget: { kind: 'host' } },
    { scope: 'global', executionTarget: { kind: 'wsl', distro: 'Ubuntu' } },
    { scope: 'workspace', folderWorkspaceId: 'folder-1' }
  ] as const)('preserves the requested destination $scope', async (destination) => {
    let archive = ''
    mocks.execute.mockImplementation(async (prepared, dependencies) => {
      archive = prepared.ingress.path
      expect((await readFile(archive)).length).toBe(prepared.package.compressedBytes)
      expect(prepared).toMatchObject({
        package: { packageId: 'kondex-bundled-skills' },
        selectedSkillIds: ['kondex-computer-use'],
        destination,
        providers: ['codex'],
        conflictDecisions: []
      })
      expect(dependencies.allowTrustedLocalFile).toBe(true)
      return { status: 'complete' }
    })
    await expect(
      new RuntimeSkillInstallCommands(host()).installBundledSkills({
        ...request(),
        destination
      })
    ).resolves.toEqual({ status: 'complete' })
    await expect(stat(archive)).rejects.toMatchObject({ code: 'ENOENT' })
    expect(mocks.ssh).not.toHaveBeenCalled()
  })

  it('sends only its generated archive to the SSH host and preserves selection', async () => {
    mocks.ssh.mockImplementation(async (input) => {
      expect(input.request.destination).toEqual({
        scope: 'global',
        executionTarget: { kind: 'host' }
      })
      expect(input.request.providers).toEqual(['codex'])
      expect(input.trustedArchivePath).toBe(input.request.ingress.path)
      expect((await stat(input.trustedArchivePath)).size).toBeGreaterThan(0)
      return { status: 'complete' }
    })
    await new RuntimeSkillInstallCommands(host()).installBundledSkills({
      ...request(),
      destination: { scope: 'global', executionTarget: { kind: 'ssh', connectionId: 'ssh-1' } }
    })
    expect(mocks.ssh).toHaveBeenCalledOnce()
    expect(mocks.execute).not.toHaveBeenCalled()
  })

  it('does not fall back to local installation when the selected SSH host is unavailable', async () => {
    const owner = host()
    owner.getSshProvider = () => undefined
    mocks.ssh.mockImplementation(async (input) => input.provider())
    await expect(
      new RuntimeSkillInstallCommands(owner).installBundledSkills({
        ...request(),
        destination: { scope: 'global', executionTarget: { kind: 'ssh', connectionId: 'missing' } }
      })
    ).rejects.toThrow('skill-install-ssh-relay-unavailable')
    expect(mocks.execute).not.toHaveBeenCalled()
    expect(mocks.ssh).toHaveBeenCalledOnce()
  })

  it.each([
    { ...request(), providers: ['cursor'] },
    { ...request(), providers: undefined },
    { ...request(), ingress: { kind: 'local-file', path: '/user-file' } },
    { ...request(), skillNames: ['unknown'] }
  ])(
    'rejects unsupported selection and caller-supplied paths before installation',
    async (input) => {
      await expect(
        new RuntimeSkillInstallCommands(host()).installBundledSkills(input as never)
      ).rejects.toThrow()
      expect(mocks.execute).not.toHaveBeenCalled()
      expect(mocks.ssh).not.toHaveBeenCalled()
    }
  )

  it('keeps generic bundle requests outside the trusted-local ingress boundary', async () => {
    mocks.execute.mockImplementation(async (_input, dependencies) => {
      expect(dependencies.allowTrustedLocalFile).toBe(false)
      throw new Error('skill-install-local-ingress-rejected')
    })
    await expect(
      new RuntimeSkillInstallCommands(host()).installSharedSkillBundleRequest({
        operationId: 'untrusted',
        ingress: { kind: 'local-file', path: '/user-file' },
        destination: request().destination
      } as never)
    ).rejects.toThrow('skill-install-local-ingress-rejected')
  })

  it('cleans up its archive after a failed install and rejects an already cancelled request', async () => {
    let archive = ''
    mocks.execute.mockImplementation(async (prepared) => {
      archive = prepared.ingress.path
      throw new Error('install failed')
    })
    const runtime = new RuntimeSkillInstallCommands(host())
    await expect(runtime.installBundledSkills(request())).rejects.toThrow('install failed')
    await expect(stat(archive)).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(runtime.installBundledSkills(request(), AbortSignal.abort())).rejects.toThrow()
    expect(mocks.execute).toHaveBeenCalledOnce()
  })
})
