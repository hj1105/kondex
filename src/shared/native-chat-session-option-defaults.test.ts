import { describe, expect, it } from 'vitest'
import {
  resolveNativeChatSessionOptionDefaults,
  updateNativeChatSessionOptionDefaults
} from './native-chat-session-option-defaults'
import type { PersistedNativeChatSessionOptions } from './native-chat-session-options'

const persistedClaude = (
  model: string | undefined,
  valuesByModel: Record<string, Record<string, string>> = {}
): PersistedNativeChatSessionOptions => ({
  claude: { ...(model ? { model } : {}), valuesByModel }
})

describe('updateNativeChatSessionOptionDefaults', () => {
  it('preserves stored option values when reselecting a model', () => {
    const reselected = updateNativeChatSessionOptionDefaults({
      persisted: persistedClaude('sonnet', { 'custom-opus': { effort: 'low' } }),
      agent: 'claude',
      modelId: 'custom-opus',
      optionId: 'model',
      value: 'custom-opus'
    })
    expect(resolveNativeChatSessionOptionDefaults(reselected, 'claude')).toEqual({
      model: 'custom-opus',
      effort: 'low'
    })
  })

  it('preserves the other agent and does not mutate the input object', () => {
    const persisted: PersistedNativeChatSessionOptions = {
      ...persistedClaude('opus'),
      codex: { model: 'custom-codex' }
    }
    const updated = updateNativeChatSessionOptionDefaults({
      persisted,
      agent: 'claude',
      modelId: 'opus',
      optionId: 'effort',
      value: 'high'
    })
    expect(updated.codex).toEqual({ model: 'custom-codex' })
    expect(updated.claude?.valuesByModel).toEqual({ opus: { effort: 'high' } })
    expect(persisted.claude?.valuesByModel).toEqual({})
  })

  it('stores an option without adopting an unverified model as a launch default', () => {
    const updated = updateNativeChatSessionOptionDefaults({
      persisted: undefined,
      agent: 'claude',
      modelId: 'sonnet',
      optionId: 'effort',
      value: 'high',
      adoptModelAsLaunchDefault: false
    })
    expect(updated.claude).toEqual({ valuesByModel: { sonnet: { effort: 'high' } } })
    expect(resolveNativeChatSessionOptionDefaults(updated, 'claude')).toBeUndefined()
  })
})

describe('resolveNativeChatSessionOptionDefaults', () => {
  it('emits nothing until a model is explicitly picked, preserving the CLI default', () => {
    expect(resolveNativeChatSessionOptionDefaults(undefined, 'claude')).toBeUndefined()
    expect(
      resolveNativeChatSessionOptionDefaults(persistedClaude(undefined), 'claude')
    ).toBeUndefined()
    expect(resolveNativeChatSessionOptionDefaults(persistedClaude('   '), 'claude')).toBeUndefined()
  })

  it('preserves a user-selected opaque model id without assuming catalog completeness', () => {
    expect(
      resolveNativeChatSessionOptionDefaults(persistedClaude('custom-opus'), 'claude')
    ).toEqual({
      model: 'custom-opus'
    })
  })
})
