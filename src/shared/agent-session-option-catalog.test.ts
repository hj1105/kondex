import { describe, expect, it } from 'vitest'
import { getAgentSessionOptionCatalog, mergeCatalogModels } from './agent-session-option-catalog'
import { resolveAgentSessionOptionLaunch } from './agent-session-option-launch'
import {
  resolveNativeChatSessionOptionDefaults,
  updateNativeChatSessionOptionDefaults
} from './native-chat-session-option-defaults'

describe('agent session option catalog', () => {
  it('returns no catalog for unknown agents', () => {
    expect(getAgentSessionOptionCatalog('future-agent')).toBeNull()
  })

  it('keeps Claude option sets model-scoped', () => {
    const catalog = getAgentSessionOptionCatalog('claude')
    expect(
      catalog?.models.find((model) => model.id === 'opus')?.options.map(({ id }) => id)
    ).toEqual(['effort', 'fastMode'])
    expect(catalog?.models.find((model) => model.id === 'haiku')?.options).toEqual([])
  })

  it('merges discovered labels while preserving cataloged option shapes', () => {
    const seed = getAgentSessionOptionCatalog('codex')!.models
    const merged = mergeCatalogModels(seed, [
      { id: 'gpt-5.5', label: 'Account model label', options: [] },
      { id: 'new-account-model', label: 'new-account-model', options: [] }
    ])
    expect(merged.find((model) => model.id === 'gpt-5.5')).toMatchObject({
      label: 'Account model label',
      options: expect.arrayContaining([expect.objectContaining({ id: 'effort' })])
    })
    expect(merged.at(-1)).toEqual({
      id: 'new-account-model',
      label: 'new-account-model',
      options: []
    })
  })

  it('labels Claude seed models by alias family so no host is mislabeled', () => {
    const catalog = getAgentSessionOptionCatalog('claude')!
    expect(catalog.models.map(({ id, label }) => ({ id, label }))).toEqual([
      { id: 'fable', label: 'Fable' },
      { id: 'opus', label: 'Opus' },
      { id: 'sonnet', label: 'Sonnet' },
      { id: 'haiku', label: 'Haiku' }
    ])
    expect(catalog.models.find((model) => model.isDefault)?.id).toBe('sonnet')
  })

  it('parses Claude list_models discovery into catalog models with options', () => {
    const stdout = JSON.stringify({
      type: 'control_response',
      response: {
        subtype: 'success',
        response: {
          models: [
            {
              value: 'default',
              displayName: 'Default (recommended)',
              supportsEffort: true,
              supportedEffortLevels: ['low', 'medium', 'high', 'xhigh', 'max'],
              supportsFastMode: true
            },
            {
              value: 'opus[1m]',
              displayName: 'Opus (1M context)',
              description: 'Opus 5 with 1M context',
              supportsEffort: true,
              supportedEffortLevels: ['low', 'medium', 'high', 'xhigh', 'max'],
              supportsFastMode: true
            },
            {
              value: 'sonnet',
              displayName: 'Sonnet',
              supportsEffort: true,
              supportedEffortLevels: ['low', 'medium', 'high']
            },
            { value: 'haiku', displayName: 'Haiku' }
          ]
        }
      }
    })
    const parsed = getAgentSessionOptionCatalog('claude')!.listModels!.parse(stdout)
    expect(parsed.map(({ id }) => id)).toEqual(['opus[1m]', 'sonnet', 'haiku'])
    expect(parsed[0]).toMatchObject({
      label: 'Opus (1M context)',
      description: 'Opus 5 with 1M context'
    })
    expect(parsed[0].options.map(({ id }) => id)).toEqual(['effort', 'fastMode'])
    const opusEffort = parsed[0].options[0]
    expect(opusEffort.kind).toMatchObject({ defaultValue: 'high' })
    expect(
      opusEffort.kind.type === 'select' ? opusEffort.kind.choices.map((c) => c.value) : []
    ).toEqual(['low', 'medium', 'high', 'xhigh', 'max'])
    const sonnetEffort = parsed[1].options[0]
    expect(
      sonnetEffort.kind.type === 'select' ? sonnetEffort.kind.choices.map((c) => c.value) : []
    ).toEqual(['low', 'medium', 'high'])
    expect(parsed[2].options).toEqual([])
  })

  it('keeps the Claude seed when list_models output is unsupported or malformed', () => {
    const parse = getAgentSessionOptionCatalog('claude')!.listModels!.parse
    const unsupported =
      '{"type":"control_response","response":{"subtype":"error","request_id":"x","error":"Unsupported control request subtype: list_models"}}'
    expect(parse(unsupported)).toEqual([])
    expect(parse('')).toEqual([])
    expect(parse('garbage')).toEqual([])
  })

  it('merges discovered Claude variants after the seed and overlays matched labels', () => {
    const catalog = getAgentSessionOptionCatalog('claude')!
    const merged = mergeCatalogModels(catalog.models, [
      { id: 'opus[1m]', label: 'Opus (1M context)', options: [] },
      { id: 'sonnet', label: 'Sonnet', description: 'Sonnet 5 · Efficient', options: [] }
    ])
    expect(merged.map(({ id }) => id)).toEqual(['fable', 'opus', 'sonnet', 'haiku', 'opus[1m]'])
    const sonnet = merged.find((model) => model.id === 'sonnet')!
    expect(sonnet.description).toBe('Sonnet 5 · Efficient')
    expect(sonnet.isDefault).toBe(true)
    expect(sonnet.options.map(({ id }) => id)).toEqual(['effort'])
  })

  it.each(['cursor', 'grok', 'openclaude', 'omp'] as const)(
    'does not restore a catalog for retired %s',
    (agent) => {
      expect(getAgentSessionOptionCatalog(agent)).toBeNull()
    }
  )

  it('does not translate persisted Cursor options into launch arguments', () => {
    const resolved = resolveAgentSessionOptionLaunch('cursor', {
      model: 'gpt-5.3-codex',
      effort: 'high',
      fastMode: true
    })
    expect(resolved).toEqual({ args: [], appliedValues: {} })
  })

  it('passes unknown model and option values through launch mappings', () => {
    expect(
      resolveAgentSessionOptionLaunch('claude', {
        model: 'claude-future',
        effort: 'future-effort'
      })
    ).toEqual({ args: ['--model', 'claude-future'], appliedValues: { model: 'claude-future' } })
    expect(
      resolveAgentSessionOptionLaunch('claude', { model: 'opus', effort: 'future-effort' })
    ).toMatchObject({
      args: ['--model', 'opus', '--effort', 'future-effort'],
      appliedValues: { model: 'opus', effort: 'future-effort' }
    })
  })

  it('resolves only stored values without leaking values across models', () => {
    let persisted = updateNativeChatSessionOptionDefaults({
      persisted: undefined,
      agent: 'claude',
      modelId: 'opus',
      optionId: 'model',
      value: 'opus'
    })
    persisted = updateNativeChatSessionOptionDefaults({
      persisted,
      agent: 'claude',
      modelId: 'opus',
      optionId: 'effort',
      value: 'xhigh'
    })
    persisted = updateNativeChatSessionOptionDefaults({
      persisted,
      agent: 'claude',
      modelId: 'sonnet',
      optionId: 'model',
      value: 'sonnet'
    })

    expect(resolveNativeChatSessionOptionDefaults(persisted, 'claude')).toEqual({
      model: 'sonnet'
    })
    expect(persisted.claude?.valuesByModel?.opus).toEqual({ effort: 'xhigh' })
  })

  it('spawns vanilla when the user has not explicitly selected a model', () => {
    // Regression (#9085): a fresh launch must not force the catalog default
    // model/effort — the agent must spawn exactly as its own CLI would.
    expect(resolveNativeChatSessionOptionDefaults(undefined, 'claude')).toBeUndefined()
    expect(resolveNativeChatSessionOptionDefaults({}, 'claude')).toBeUndefined()
    expect(resolveNativeChatSessionOptionDefaults({}, 'future-agent')).toBeUndefined()
  })

  it('resolves an explicitly selected model and only its stored options', () => {
    let persisted = updateNativeChatSessionOptionDefaults({
      persisted: undefined,
      agent: 'claude',
      modelId: 'opus',
      optionId: 'model',
      value: 'opus'
    })
    expect(resolveNativeChatSessionOptionDefaults(persisted, 'claude')).toEqual({
      model: 'opus'
    })
    persisted = updateNativeChatSessionOptionDefaults({
      persisted,
      agent: 'claude',
      modelId: 'opus',
      optionId: 'effort',
      value: 'xhigh'
    })
    expect(resolveNativeChatSessionOptionDefaults(persisted, 'claude')).toEqual({
      model: 'opus',
      effort: 'xhigh'
    })
  })

  it('keeps catalog option defaults after the user explicitly selects a model', () => {
    const persisted = updateNativeChatSessionOptionDefaults({
      persisted: undefined,
      agent: 'claude',
      modelId: 'sonnet',
      optionId: 'model',
      value: 'sonnet'
    })
    const defaults = resolveNativeChatSessionOptionDefaults(persisted, 'claude')

    expect(resolveAgentSessionOptionLaunch('claude', defaults)).toEqual({
      args: ['--model', 'sonnet', '--effort', 'high'],
      appliedValues: { model: 'sonnet', effort: 'high' }
    })
  })
})
