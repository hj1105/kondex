import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CatalogModel } from '../../../../shared/agent-session-option-catalog'
import {
  discoverNativeChatCatalogModels,
  resolveNativeChatModelDiscoveryHostKey
} from './native-chat-session-option-discovery'
import {
  clearNativeChatModelEnrichmentForTests,
  ensureNativeChatModelEnrichment,
  readNativeChatEnrichedModels,
  resolveNativeChatLaunchSessionOptions,
  subscribeNativeChatEnrichedModels
} from './native-chat-session-option-enrichment'

const mocks = vi.hoisted(() => ({ discoverRuntimeCommitMessageModels: vi.fn() }))
vi.mock('@/runtime/runtime-git-client', () => ({
  discoverRuntimeCommitMessageModels: mocks.discoverRuntimeCommitMessageModels,
  getRuntimeGitScope: vi.fn()
}))
const context = { settings: {}, worktreeId: 'repo::/worktree', worktreePath: '/worktree' }

describe('native chat model enrichment', () => {
  beforeEach(() => {
    clearNativeChatModelEnrichmentForTests()
    mocks.discoverRuntimeCommitMessageModels.mockReset()
  })

  it('keeps reads synchronous while one host-scoped probe is in flight', async () => {
    let settle!: (models: CatalogModel[]) => void
    const discover = vi.fn(
      () =>
        new Promise<CatalogModel[]>((resolve) => {
          settle = resolve
        })
    )
    const listener = vi.fn()
    const unsubscribe = subscribeNativeChatEnrichedModels('claude', 'ssh:one', listener)
    ensureNativeChatModelEnrichment({ agent: 'claude', hostKey: 'ssh:one', discover })
    ensureNativeChatModelEnrichment({ agent: 'claude', hostKey: 'ssh:one', discover })
    expect(readNativeChatEnrichedModels('claude', 'ssh:one')).toBeNull()
    expect(discover).toHaveBeenCalledOnce()
    const rows: CatalogModel[] = [{ id: 'opus', label: 'Account Opus', options: [] }]
    settle(rows)
    await vi.waitFor(() => expect(listener).toHaveBeenCalledExactlyOnceWith(rows))
    expect(readNativeChatEnrichedModels('claude', 'ssh:one')).toEqual(rows)
    expect(readNativeChatEnrichedModels('claude', 'ssh:two')).toBeNull()
    expect(readNativeChatEnrichedModels('codex', 'ssh:one')).toBeNull()
    unsubscribe()
  })

  it('does not repeat a failed once-per-host probe', async () => {
    const discover = vi.fn().mockRejectedValue(new Error('offline'))
    ensureNativeChatModelEnrichment({ agent: 'claude', hostKey: 'local', discover })
    await vi.waitFor(() => expect(discover).toHaveBeenCalledOnce())
    await Promise.resolve()
    ensureNativeChatModelEnrichment({ agent: 'claude', hostKey: 'local', discover })
    expect(discover).toHaveBeenCalledOnce()
    expect(readNativeChatEnrichedModels('claude', 'local')).toBeNull()
  })

  it.each(['codex', 'cursor', 'grok', 'gemini'] as const)(
    'does not probe %s without a catalog discovery command',
    async (agent) => {
      mocks.discoverRuntimeCommitMessageModels.mockResolvedValue({
        success: true,
        catalogOrigin: 'probe',
        models: [{ id: 'unexpected', label: 'Unexpected model' }]
      })
      const discover = vi.fn()
      ensureNativeChatModelEnrichment({ agent, hostKey: 'local', discover })
      expect(discover).not.toHaveBeenCalled()
      await expect(discoverNativeChatCatalogModels(agent, context)).resolves.toBeNull()
      expect(mocks.discoverRuntimeCommitMessageModels).not.toHaveBeenCalled()
    }
  )

  it('keeps WSL discovery separate from Windows and other distros', () => {
    expect(
      resolveNativeChatModelDiscoveryHostKey(
        {} as never,
        null,
        '\\\\wsl.localhost\\Ubuntu\\home\\user',
        null
      )
    ).toBe('wsl:Ubuntu')
    expect(
      resolveNativeChatModelDiscoveryHostKey(
        {} as never,
        null,
        '\\\\wsl.localhost\\Debian\\home\\user',
        null
      )
    ).toBe('wsl:Debian')
    expect(resolveNativeChatModelDiscoveryHostKey({} as never, null, 'C:\\repo', null)).toBe(
      'local'
    )
  })

  it('publishes only probed Claude rows with their own capabilities and default flag', async () => {
    mocks.discoverRuntimeCommitMessageModels.mockResolvedValue({
      success: true,
      catalogOrigin: 'probe',
      models: [
        {
          id: 'opus[1m]',
          label: 'Opus (1M context)',
          description: 'Account model',
          thinkingLevels: [
            { id: 'low', label: 'Low' },
            { id: 'high', label: 'High' }
          ],
          supportsFastMode: true,
          isDefault: true
        },
        { id: 'sonnet', label: 'Sonnet', thinkingLevels: [{ id: 'medium', label: 'Medium' }] }
      ]
    })
    ensureNativeChatModelEnrichment({
      agent: 'claude',
      hostKey: 'ssh:host',
      discover: () => discoverNativeChatCatalogModels('claude', context)
    })
    await vi.waitFor(() =>
      expect(readNativeChatEnrichedModels('claude', 'ssh:host')).not.toBeNull()
    )
    const models = readNativeChatEnrichedModels('claude', 'ssh:host')!
    expect(models.map(({ id, isDefault }) => [id, isDefault])).toEqual([
      ['opus[1m]', true],
      ['sonnet', undefined]
    ])
    expect(models[0]).toMatchObject({
      description: 'Account model',
      options: [
        expect.objectContaining({
          id: 'effort',
          kind: expect.objectContaining({
            choices: [
              { value: 'low', label: 'Low' },
              { value: 'high', label: 'High' }
            ]
          })
        }),
        expect.objectContaining({ id: 'fastMode' })
      ]
    })
    expect(models[1].options).toEqual([
      expect.objectContaining({
        id: 'effort',
        kind: expect.objectContaining({ choices: [{ value: 'medium', label: 'Medium' }] })
      })
    ])
    expect(readNativeChatEnrichedModels('claude', 'local')).toBeNull()
  })

  it('does not invent default flags or option menus an older host omitted', async () => {
    mocks.discoverRuntimeCommitMessageModels.mockResolvedValue({
      success: true,
      catalogOrigin: 'probe',
      models: [{ id: 'sonnet', label: 'Sonnet' }]
    })
    ensureNativeChatModelEnrichment({
      agent: 'claude',
      hostKey: 'ssh:legacy',
      discover: () => discoverNativeChatCatalogModels('claude', context)
    })
    await vi.waitFor(() =>
      expect(readNativeChatEnrichedModels('claude', 'ssh:legacy')).not.toBeNull()
    )
    expect(readNativeChatEnrichedModels('claude', 'ssh:legacy')).toEqual([
      { id: 'sonnet', label: 'Sonnet', options: [] }
    ])
  })

  it.each([
    { success: true, catalogOrigin: 'spec', models: [{ id: 'sonnet', label: 'Sonnet' }] },
    { success: true, models: [{ id: 'sonnet', label: 'Sonnet' }] },
    { success: true, catalogOrigin: 'probe', models: [] },
    { success: false, models: [] }
  ])('rejects an unverified or empty Claude list (%j)', async (result) => {
    mocks.discoverRuntimeCommitMessageModels.mockResolvedValue(result)
    await expect(discoverNativeChatCatalogModels('claude', context)).resolves.toBeNull()
  })

  it('keeps explicit launch models despite a different host catalog', async () => {
    const persisted = {
      claude: { model: 'private-model', valuesByModel: { 'private-model': { effort: 'low' } } },
      codex: { model: 'account-codex' }
    }
    expect(resolveNativeChatLaunchSessionOptions(persisted, 'claude')).toEqual({
      model: 'private-model',
      effort: 'low'
    })
    ensureNativeChatModelEnrichment({
      agent: 'claude',
      hostKey: 'ssh:other',
      discover: async () => [{ id: 'sonnet', label: 'Sonnet', options: [] }]
    })
    await vi.waitFor(() =>
      expect(readNativeChatEnrichedModels('claude', 'ssh:other')).not.toBeNull()
    )
    expect(resolveNativeChatLaunchSessionOptions(persisted, 'claude')).toEqual({
      model: 'private-model',
      effort: 'low'
    })
    expect(resolveNativeChatLaunchSessionOptions(persisted, 'codex')).toEqual({
      model: 'account-codex'
    })
    expect(resolveNativeChatLaunchSessionOptions({}, 'claude')).toBeUndefined()
  })
})
