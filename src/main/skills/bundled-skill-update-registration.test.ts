import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SkillInstallReceiptV1 } from './skill-install-provenance'

const mocks = vi.hoisted(() => ({ read: vi.fn(), observe: vi.fn(), alias: vi.fn() }))
vi.mock('./skill-install-provenance', () => ({ readSkillInstallReceipt: mocks.read }))
vi.mock('./skill-install-filesystem', () => ({
  nativeSkillInstallFilesystem: { observeSkill: mocks.observe, aliasTargets: mocks.alias }
}))
import { readBundledSkillUpdateRegistrations } from './bundled-skill-update-registration'

const homeDir = join(process.cwd(), 'fixture-home')
const stateDirectory = join(homeDir, 'state')
const canonicalPath = join(homeDir, '.agents', 'skills', 'kondex-cli')
const providerPath = join(homeDir, 'custom-claude', 'skills', 'kondex-cli')
let receipt: SkillInstallReceiptV1
beforeEach(() => {
  vi.resetAllMocks()
  receipt = {
    schemaVersion: 1,
    packageId: 'kondex-bundled-skills',
    versionId: 'previous',
    packageDigest: 'digest',
    archiveSha256: 'archive',
    scope: 'global',
    destinationIdentity: 'global:fixture',
    canonicalPath,
    placements: [],
    providers: ['claude'],
    installedAt: new Date(0).toISOString(),
    hostIdentity: 'local'
  }
  mocks.read.mockImplementation(async () => receipt)
  mocks.observe.mockResolvedValue({ observedDigest: 'digest' })
  mocks.alias.mockResolvedValue(true)
})
const registrations = () =>
  readBundledSkillUpdateRegistrations(['kondex-cli'], { homeDir, stateDirectory })
describe('receipt-owned update eligibility', () => {
  it('reads only canonical built-in names from the selected profile', async () => {
    const result = await readBundledSkillUpdateRegistrations(
      ['kondex-cli', 'kondex-cli', 'orca-cli', '../bad'],
      { homeDir, stateDirectory }
    )
    expect([...result.keys()]).toEqual(['kondex-cli'])
    expect(mocks.read).toHaveBeenCalledExactlyOnceWith(
      join(stateDirectory, 'skill-installs'),
      canonicalPath
    )
  })
  it.each([
    { packageId: 'someone-else' },
    { scope: 'workspace' },
    { wslDistro: 'Ubuntu' }
  ] as Partial<SkillInstallReceiptV1>[])(
    'rejects a receipt outside this updater: %j',
    async (fields) => {
      Object.assign(receipt, fields)
      expect((await registrations()).size).toBe(0)
      expect(mocks.observe).not.toHaveBeenCalled()
    }
  )
  it('refuses an absent receipt or unreadable canonical directory', async () => {
    mocks.read.mockResolvedValueOnce(null)
    expect((await registrations()).size).toBe(0)
    mocks.observe.mockRejectedValue(new Error('EACCES'))
    expect((await registrations()).size).toBe(0)
  })
  it('refuses edits even when they happen to match another known release', async () => {
    mocks.observe.mockResolvedValue({ observedDigest: 'different-known-version' })
    expect((await registrations()).size).toBe(0)
  })
  it('verifies retained custom provider aliases, including broken or retargeted aliases', async () => {
    receipt.placements = [
      { provider: 'claude', path: providerPath, topology: 'provider-alias', status: 'installed' }
    ]
    expect((await registrations()).size).toBe(1)
    expect(mocks.alias).toHaveBeenCalledWith(canonicalPath, providerPath)
    mocks.alias.mockResolvedValue(false)
    expect((await registrations()).size).toBe(0)
  })
  it('verifies independent copies from a receipt instead of ignoring non-default roots', async () => {
    receipt.placements = [
      { provider: 'claude', path: providerPath, topology: 'independent-copy', status: 'installed' }
    ]
    expect((await registrations()).size).toBe(1)
    mocks.observe.mockImplementation(async (path: string) => ({
      observedDigest: path === canonicalPath ? 'digest' : 'changed'
    }))
    expect((await registrations()).size).toBe(0)
  })
  it('rejects malformed placement paths before observing them', async () => {
    receipt.placements = [
      { provider: 'claude', path: '../outside', topology: 'independent-copy', status: 'installed' }
    ]
    expect((await registrations()).size).toBe(0)
    expect(mocks.observe).toHaveBeenCalledTimes(1)
  })
})
