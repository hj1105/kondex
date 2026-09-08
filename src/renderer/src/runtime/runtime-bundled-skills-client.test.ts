import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ call: vi.fn() }))
vi.mock('./runtime-rpc-client', () => ({ callRuntimeRpc: mocks.call }))
import { installBundledSkillsOnRuntimeTarget } from './runtime-bundled-skills-client'
import { BUNDLED_SKILL_INSTALL_CAPABILITY } from '../../../shared/bundled-skill-install-contract'
import { replaceRuntimeEnvironmentRevisions } from './runtime-environment-revision'

const request = {
  operationId: 'gui-install',
  skillNames: ['kondex-cli'],
  providers: ['codex' as const],
  destination: {
    scope: 'global' as const,
    executionTarget: { kind: 'wsl' as const, distro: 'Ubuntu' }
  }
}
const result = {
  operationId: request.operationId,
  packageId: 'kondex-bundled-skills',
  versionId: 'version-1',
  bundleDigest: 'a'.repeat(64),
  status: 'complete',
  skills: []
}
beforeEach(() => {
  vi.resetAllMocks()
  replaceRuntimeEnvironmentRevisions([{ id: 'peer-1', createdAt: 1, pairingRevision: 4 }])
})
describe('bundled skill GUI runtime client', () => {
  it('pins the pairing revision before capability probing so a re-pair cannot retarget installation', async () => {
    mocks.call
      .mockImplementationOnce(async () => {
        replaceRuntimeEnvironmentRevisions([{ id: 'peer-1', createdAt: 1, pairingRevision: 5 }])
        return { capabilities: [BUNDLED_SKILL_INSTALL_CAPABILITY] }
      })
      .mockResolvedValueOnce(result)
    await installBundledSkillsOnRuntimeTarget(
      { kind: 'environment', environmentId: 'peer-1' },
      request
    )
    expect(mocks.call.mock.calls[1]?.[3]).toEqual({
      expectedEnvironmentPairingRevision: 4,
      timeoutMs: 300_000
    })
  })
  it.each([{ kind: 'local' }, { kind: 'environment', environmentId: 'peer-1' }] as const)(
    'checks the $kind host capability and keeps its exact destination',
    async (target) => {
      mocks.call
        .mockResolvedValueOnce({ capabilities: [BUNDLED_SKILL_INSTALL_CAPABILITY] })
        .mockResolvedValueOnce(result)
      await expect(installBundledSkillsOnRuntimeTarget(target, request)).resolves.toEqual(result)
      const revision =
        target.kind === 'environment' ? { expectedEnvironmentPairingRevision: 4 } : {}
      expect(mocks.call).toHaveBeenNthCalledWith(1, target, 'status.get', undefined, revision)
      expect(mocks.call).toHaveBeenNthCalledWith(2, target, 'skills.installBundled', request, {
        ...revision,
        timeoutMs: 300_000
      })
    }
  )
  it.each([{}, { capabilities: [] }])(
    'refuses an older host without a fallback install',
    async (status) => {
      mocks.call.mockResolvedValue(status)
      await expect(installBundledSkillsOnRuntimeTarget({ kind: 'local' }, request)).rejects.toThrow(
        'Update Kondex'
      )
      expect(mocks.call).toHaveBeenCalledOnce()
    }
  )
  it('does not retry a failed mutation against another host', async () => {
    mocks.call
      .mockResolvedValueOnce({ capabilities: [BUNDLED_SKILL_INSTALL_CAPABILITY] })
      .mockRejectedValueOnce(new Error('Disconnected'))
    await expect(
      installBundledSkillsOnRuntimeTarget({ kind: 'environment', environmentId: 'peer-1' }, request)
    ).rejects.toThrow('Disconnected')
    expect(mocks.call).toHaveBeenCalledTimes(2)
  })
})
