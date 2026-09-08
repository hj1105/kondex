import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  COMMIT_MESSAGE_AGENT_SPECS,
  CUSTOM_AGENT_ID,
  DEFAULT_COMMIT_MESSAGE_AGENT_ID,
  getCommitMessageAgentCapability,
  getCommitMessageAgentSpec,
  getCommitMessageModelCapability,
  getCommitMessageModel,
  isCustomAgentId,
  listCommitMessageAgentCapabilities,
  listCommitMessageAgentIds,
  resolveCommitMessageAgentChoice
} from './commit-message-agent-spec'
import {
  COMMIT_MESSAGE_MODEL_JSON_STRUCTURE_LIMITS,
  parseClaudeModels,
  parseCodexModels
} from './commit-message-model-parsers'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('COMMIT_MESSAGE_AGENT_SPECS', () => {
  it('exposes the installed local agents as commit-message agents', () => {
    const ids = listCommitMessageAgentIds().sort()
    expect(ids).toEqual(['claude', 'codex'])
  })

  it('uses the strongest available defaults for core agents', () => {
    expect(COMMIT_MESSAGE_AGENT_SPECS.claude?.defaultModelId).toBe('sonnet')
    expect(COMMIT_MESSAGE_AGENT_SPECS.codex?.defaultModelId).toBe('gpt-5.5')
  })

  it('defaults the agent picker to Claude', () => {
    expect(DEFAULT_COMMIT_MESSAGE_AGENT_ID).toBe('claude')
  })

  it('treats disabled default agents as unavailable for implicit Source Control AI choices', () => {
    expect(resolveCommitMessageAgentChoice(null, 'codex', ['codex'])).toBe('claude')
    expect(resolveCommitMessageAgentChoice(null, null, ['claude'])).toBeNull()
    expect(resolveCommitMessageAgentChoice('codex', null, ['codex'])).toBe('codex')
  })

  it('gives every model with thinking levels a valid default', () => {
    for (const spec of Object.values(COMMIT_MESSAGE_AGENT_SPECS)) {
      if (!spec) {
        continue
      }
      for (const model of spec.models) {
        if (model.thinkingLevels) {
          expect(model.defaultThinkingLevel).toBeDefined()
          expect(model.thinkingLevels.some((l) => l.id === model.defaultThinkingLevel)).toBe(true)
        }
      }
    }
  })

  it('exposes thinking levels on the Spark variant (it accepts model_reasoning_effort)', () => {
    const spark = getCommitMessageModel('codex', 'gpt-5.3-codex-spark')
    expect(spark).toBeDefined()
    expect(spark?.thinkingLevels?.map((l) => l.id)).toEqual(['low', 'medium', 'high', 'xhigh'])
    expect(spark?.defaultThinkingLevel).toBe('low')
  })

  it('omits thinking levels on Claude Haiku (non-reasoning model)', () => {
    const haiku = getCommitMessageModel('claude', 'haiku')
    expect(haiku).toBeDefined()
    expect(haiku?.thinkingLevels).toBeUndefined()
    expect(haiku?.defaultThinkingLevel).toBeUndefined()
  })

  it('identifies the custom sentinel via isCustomAgentId', () => {
    expect(isCustomAgentId(CUSTOM_AGENT_ID)).toBe(true)
    expect(isCustomAgentId('claude')).toBe(false)
    expect(isCustomAgentId('codex')).toBe(false)
    expect(isCustomAgentId(null)).toBe(false)
    expect(isCustomAgentId(undefined)).toBe(false)
  })

  it('does not list "custom" alongside preset agent ids', () => {
    expect(listCommitMessageAgentIds()).not.toContain(CUSTOM_AGENT_ID)
  })

  it('orders Codex models by version descending to match the official picker', () => {
    const ids = COMMIT_MESSAGE_AGENT_SPECS.codex?.models.map((m) => m.id)
    expect(ids).toEqual([
      'gpt-5.5',
      'gpt-5.4',
      'gpt-5.4-mini',
      'gpt-5.3-codex',
      'gpt-5.3-codex-spark',
      'gpt-5.2'
    ])
  })

  it('exposes UI capabilities without spawn details', () => {
    const capabilities = listCommitMessageAgentCapabilities()
    expect(capabilities.map((capability) => capability.id)).toEqual(['claude', 'codex'])
    const codex = getCommitMessageAgentCapability('codex')
    expect(codex).toMatchObject({
      id: 'codex',
      label: 'Codex',
      modelSource: 'dynamic',
      defaultModelId: 'gpt-5.5'
    })
    expect(codex).not.toHaveProperty('binary')
    expect(codex).not.toHaveProperty('buildArgs')
    expect(getCommitMessageModelCapability('codex', 'gpt-5.4-mini')?.thinkingLevels).toBeDefined()
  })
})

describe('buildArgs (Claude)', () => {
  const spec = getCommitMessageAgentSpec('claude')!

  it('passes -p, output format, and model on every call', () => {
    const args = spec.buildArgs({ prompt: '', model: 'haiku' })
    expect(args).toEqual([
      '-p',
      '--output-format',
      'text',
      '--model',
      'haiku',
      '--permission-mode',
      'plan'
    ])
  })

  it('appends --effort when a thinking level is supplied', () => {
    const args = spec.buildArgs({
      prompt: '',
      model: 'sonnet',
      thinkingLevel: 'high'
    })
    expect(args).toEqual([
      '-p',
      '--output-format',
      'text',
      '--model',
      'sonnet',
      '--permission-mode',
      'plan',
      '--effort',
      'high'
    ])
  })

  it('omits --effort when thinkingLevel is not provided', () => {
    const args = spec.buildArgs({ prompt: '', model: 'opus' })
    expect(args).not.toContain('--effort')
  })
})

describe('model discovery parsers', () => {
  it('parses Claude list_models output into commit-message models', () => {
    const stdout = `${JSON.stringify({
      type: 'control_response',
      response: {
        subtype: 'success',
        request_id: 'orca-model-discovery',
        response: {
          models: [
            {
              value: 'default',
              displayName: 'Default (recommended)',
              supportsEffort: true,
              supportedEffortLevels: ['low', 'medium', 'high', 'xhigh', 'max']
            },
            {
              value: 'opus[1m]',
              displayName: 'Opus (1M context)',
              description: 'Opus 5 with 1M context · $5/$25 per Mtok',
              supportsEffort: true,
              supportedEffortLevels: ['low', 'medium', 'high', 'xhigh', 'max'],
              supportsFastMode: true
            },
            { value: 'haiku', displayName: 'Haiku' }
          ]
        }
      }
    })}\n`
    expect(parseClaudeModels(stdout)).toEqual([
      {
        id: 'opus[1m]',
        label: 'Opus (1M context)',
        description: 'Opus 5 with 1M context · $5/$25 per Mtok',
        thinkingLevels: [
          { id: 'low', label: 'Low' },
          { id: 'medium', label: 'Medium' },
          { id: 'high', label: 'High' },
          { id: 'xhigh', label: 'Extra High' },
          { id: 'max', label: 'Max' }
        ],
        defaultThinkingLevel: 'low',
        supportsFastMode: true
      },
      { id: 'haiku', label: 'Haiku' }
    ])
  })

  it('returns no Claude models when the CLI lacks list_models so the seed stays', () => {
    expect(
      parseClaudeModels(
        '{"type":"control_response","response":{"subtype":"error","request_id":"orca-model-discovery","error":"Unsupported control request subtype: list_models"}}\n'
      )
    ).toEqual([])
  })

  it('declares stdin-driven dynamic discovery for Claude', () => {
    const discovery = COMMIT_MESSAGE_AGENT_SPECS.claude?.modelDiscovery
    expect(COMMIT_MESSAGE_AGENT_SPECS.claude?.modelSource).toBe('dynamic')
    expect(discovery?.binary).toBe('claude')
    expect(discovery?.args).toEqual([
      '-p',
      '--input-format',
      'stream-json',
      '--output-format',
      'stream-json',
      '--verbose'
    ])
    const payload = JSON.parse(discovery?.stdinPayload ?? '') as {
      type?: string
      request?: { subtype?: string }
    }
    expect(payload.type).toBe('control_request')
    expect(payload.request?.subtype).toBe('list_models')
    expect(discovery?.stdinPayload?.endsWith('\n')).toBe(true)
  })

  it('parses Codex model JSON', () => {
    expect(
      parseCodexModels(
        JSON.stringify({
          models: [
            {
              slug: 'gpt-5.5',
              display_name: 'GPT-5.5',
              default_reasoning_level: 'low',
              supported_reasoning_levels: [{ effort: 'low' }, { effort: 'high' }]
            }
          ]
        })
      )
    ).toEqual([
      {
        id: 'gpt-5.5',
        label: 'GPT-5.5',
        thinkingLevels: [
          { id: 'low', label: 'Low' },
          { id: 'high', label: 'High' }
        ],
        defaultThinkingLevel: 'low'
      }
    ])
  })

  it('rejects excessive Codex model nesting before JSON.parse', () => {
    const parseSpy = vi.spyOn(JSON, 'parse')
    const depth = COMMIT_MESSAGE_MODEL_JSON_STRUCTURE_LIMITS.nestingDepth + 1
    try {
      expect(parseCodexModels(`${'['.repeat(depth)}0${']'.repeat(depth)}`)).toEqual([])
      expect(parseSpy).not.toHaveBeenCalled()
    } finally {
      parseSpy.mockRestore()
    }
  })
})

describe('buildArgs (Codex)', () => {
  const spec = getCommitMessageAgentSpec('codex')!

  it('runs `codex exec` without passing the prompt via argv', () => {
    const args = spec.buildArgs({
      prompt: 'PROMPT',
      model: 'gpt-5.4-mini'
    })
    expect(args[0]).toBe('exec')
    expect(args).toEqual([
      'exec',
      '--ephemeral',
      '--skip-git-repo-check',
      '-s',
      'read-only',
      '--model',
      'gpt-5.4-mini'
    ])
    expect(args).toContain('--model')
    expect(args).not.toContain('PROMPT')
    expect(spec.promptDelivery).toBe('stdin')
  })

  it('emits -c model_reasoning_effort=<level> when thinking level is supplied', () => {
    const args = spec.buildArgs({
      prompt: 'PROMPT',
      model: 'gpt-5.4',
      thinkingLevel: 'medium'
    })
    expect(args).toContain('-c')
    expect(args).toContain('model_reasoning_effort=medium')
  })

  it('omits the -c flag when no thinking level is supplied', () => {
    const args = spec.buildArgs({ prompt: 'PROMPT', model: 'gpt-5.4-mini' })
    expect(args).not.toContain('-c')
  })
})
