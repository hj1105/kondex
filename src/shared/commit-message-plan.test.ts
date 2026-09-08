import { describe, expect, it } from 'vitest'
import { planCommitMessageGeneration, planAgentBinary } from './commit-message-plan'

describe('planCommitMessageGeneration', () => {
  it('plans Claude non-interactive generation with the prompt on stdin only', () => {
    const result = planCommitMessageGeneration(
      {
        agentId: 'claude',
        model: 'sonnet',
        thinkingLevel: 'high'
      },
      'PROMPT'
    )

    expect(result).toEqual({
      ok: true,
      plan: {
        binary: 'claude',
        args: [
          '-p',
          '--output-format',
          'text',
          '--model',
          'sonnet',
          '--permission-mode',
          'plan',
          '--effort',
          'high'
        ],
        stdinPayload: 'PROMPT',
        label: 'Claude'
      }
    })
  })

  it('allows discovered dynamic models that are not in the seed catalog', () => {
    const result = planCommitMessageGeneration(
      {
        agentId: 'codex',
        model: 'gpt-5.2',
        thinkingLevel: 'xhigh'
      },
      'PROMPT'
    )

    expect(result).toEqual({
      ok: true,
      plan: {
        binary: 'codex',
        args: [
          'exec',
          '--ephemeral',
          '--skip-git-repo-check',
          '-s',
          'read-only',
          '--model',
          'gpt-5.2',
          '-c',
          'model_reasoning_effort=xhigh'
        ],
        stdinPayload: 'PROMPT',
        label: 'Codex'
      }
    })
  })

  it('plans Codex exec as non-interactive read-only generation with the prompt on stdin only', () => {
    const result = planCommitMessageGeneration(
      {
        agentId: 'codex',
        model: 'gpt-5.4-mini',
        thinkingLevel: 'medium'
      },
      'PROMPT'
    )

    expect(result).toEqual({
      ok: true,
      plan: {
        binary: 'codex',
        args: [
          'exec',
          '--ephemeral',
          '--skip-git-repo-check',
          '-s',
          'read-only',
          '--model',
          'gpt-5.4-mini',
          '-c',
          'model_reasoning_effort=medium'
        ],
        stdinPayload: 'PROMPT',
        label: 'Codex'
      }
    })
  })

  it('uses preset agent command overrides as the spawn command prefix', () => {
    const result = planCommitMessageGeneration(
      {
        agentId: 'codex',
        model: 'gpt-5.4-mini',
        agentCommandOverride: 'npx codex'
      },
      'PROMPT'
    )

    expect(result).toMatchObject({
      ok: true,
      plan: {
        binary: 'npx',
        args: [
          'codex',
          'exec',
          '--ephemeral',
          '--skip-git-repo-check',
          '-s',
          'read-only',
          '--model',
          'gpt-5.4-mini'
        ],
        stdinPayload: 'PROMPT'
      }
    })
  })

  it.each([
    ['long option', '--model gpt-5.6-luna', ['--model', 'gpt-5.6-luna'], []],
    ['short option', '-m gpt-5.6-luna', ['-m', 'gpt-5.6-luna'], []],
    ['equals form', '--model=gpt-5.6-luna', ['--model=gpt-5.6-luna'], []],
    ['attached short form', '-mgpt-5.6-luna', ['-mgpt-5.6-luna'], []],
    [
      'sibling arguments',
      '--model gpt-5.6-luna --sandbox read-only',
      ['--model', 'gpt-5.6-luna'],
      ['--sandbox', 'read-only']
    ]
  ])(
    'lets Codex recipe args override the generated model via %s',
    (_, agentArgs, overrideArgs, trailingArgs) => {
      const result = planCommitMessageGeneration(
        { agentId: 'codex', model: 'gpt-5.4-mini', thinkingLevel: 'medium', agentArgs },
        'PROMPT'
      )

      expect(result).toMatchObject({
        ok: true,
        plan: {
          args: [
            'exec',
            '--ephemeral',
            '--skip-git-repo-check',
            '-s',
            'read-only',
            ...overrideArgs,
            '-c',
            'model_reasoning_effort=medium',
            ...trailingArgs
          ],
          stdinPayload: 'PROMPT'
        }
      })
    }
  )

  it('keeps Codex recipe arguments unchanged when they do not override the model', () => {
    const result = planCommitMessageGeneration(
      {
        agentId: 'codex',
        model: 'gpt-5.4-mini',
        agentArgs: '--sandbox workspace-write'
      },
      'PROMPT'
    )

    expect(result).toMatchObject({
      ok: true,
      plan: {
        args: [
          'exec',
          '--ephemeral',
          '--skip-git-repo-check',
          '-s',
          'read-only',
          '--model',
          'gpt-5.4-mini',
          '--sandbox',
          'workspace-write'
        ]
      }
    })
  })

  it('keeps the generated Codex model when model-like text follows an option terminator', () => {
    const result = planCommitMessageGeneration(
      {
        agentId: 'codex',
        model: 'gpt-5.4-mini',
        agentArgs: '-- --model literal'
      },
      'PROMPT'
    )

    expect(result).toMatchObject({
      ok: true,
      plan: {
        args: [
          'exec',
          '--ephemeral',
          '--skip-git-repo-check',
          '-s',
          'read-only',
          '--model',
          'gpt-5.4-mini',
          '--',
          '--model',
          'literal'
        ]
      }
    })
  })

  it('collapses a singleton flag the user typed twice in one field', () => {
    const result = planCommitMessageGeneration(
      {
        agentId: 'codex',
        model: 'gpt-5.4-mini',
        agentArgs: '--model first -m second'
      },
      'PROMPT'
    )

    expect(result).toMatchObject({
      ok: true,
      plan: {
        args: [
          'exec',
          '--ephemeral',
          '--skip-git-repo-check',
          '-s',
          'read-only',
          '--model',
          'first'
        ]
      }
    })
  })

  it('keeps a model flag in the agent command override and removes the generated duplicate', () => {
    const result = planCommitMessageGeneration(
      {
        agentId: 'codex',
        model: 'gpt-5.4-mini',
        agentCommandOverride: 'npx codex --model gpt-5.5 --log-level DEBUG'
      },
      'PROMPT'
    )

    expect(result).toMatchObject({
      ok: true,
      plan: {
        binary: 'npx',
        args: [
          'codex',
          '--model',
          'gpt-5.5',
          '--log-level',
          'DEBUG',
          'exec',
          '--ephemeral',
          '--skip-git-repo-check',
          '-s',
          'read-only'
        ]
      }
    })
  })

  it('does not move command override options across an option terminator', () => {
    const result = planCommitMessageGeneration(
      {
        agentId: 'codex',
        model: 'gpt-5.4-mini',
        agentCommandOverride: 'codex --model from-override -- --model literal'
      },
      'PROMPT'
    )

    expect(result).toMatchObject({
      ok: true,
      plan: {
        args: [
          '--model',
          'from-override',
          '--',
          '--model',
          'literal',
          'exec',
          '--ephemeral',
          '--skip-git-repo-check',
          '-s',
          'read-only',
          '--model',
          'gpt-5.4-mini'
        ]
      }
    })
  })

  it('lets recipe args outrank a command override that also sets the model', () => {
    const result = planCommitMessageGeneration(
      {
        agentId: 'codex',
        model: 'gpt-5.4-mini',
        agentCommandOverride: 'codex --model from-override',
        agentArgs: '--model from-recipe'
      },
      'PROMPT'
    )

    expect(result).toMatchObject({
      ok: true,
      plan: {
        binary: 'codex',
        args: [
          'exec',
          '--ephemeral',
          '--skip-git-repo-check',
          '-s',
          'read-only',
          '--model',
          'from-recipe'
        ]
      }
    })
  })

  it('keeps custom per-action CLI arguments before a positional prompt', () => {
    const result = planCommitMessageGeneration(
      {
        agentId: 'custom',
        model: '',
        customAgentCommand: 'agent --message {prompt}',
        agentArgs: '--model gpt-5.5'
      },
      'PROMPT'
    )

    expect(result).toEqual({
      ok: true,
      plan: {
        binary: 'agent',
        args: ['--message', '--model', 'gpt-5.5', 'PROMPT'],
        stdinPayload: null,
        label: 'agent'
      }
    })
  })

  it('appends custom per-action CLI arguments when the prompt is sent on stdin', () => {
    const result = planCommitMessageGeneration(
      {
        agentId: 'custom',
        model: '',
        customAgentCommand: 'agent --message',
        agentArgs: '--model gpt-5.5'
      },
      'PROMPT'
    )

    expect(result).toMatchObject({
      ok: true,
      plan: {
        args: ['--message', '--model', 'gpt-5.5'],
        stdinPayload: 'PROMPT'
      }
    })
  })

  it('rejects invalid per-action CLI arguments before spawning', () => {
    const result = planCommitMessageGeneration(
      {
        agentId: 'claude',
        model: 'haiku',
        agentArgs: '--model "unterminated'
      },
      'PROMPT'
    )

    expect(result).toEqual({
      ok: false,
      error: 'CLI arguments are invalid: Unclosed quote in command template.'
    })
  })

  it('rejects invalid preset agent command overrides before spawning', () => {
    const result = planCommitMessageGeneration(
      {
        agentId: 'claude',
        model: 'haiku',
        agentCommandOverride: 'claude "unterminated'
      },
      'PROMPT'
    )

    expect(result).toEqual({
      ok: false,
      error: 'Agent command override is invalid: Unclosed quote in command template.'
    })
  })
})

describe('backslash mode reaches every command the user can type (#11375)', () => {
  const WINDOWS_BINARY = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'

  it('keeps an agent command override intact in literal mode', () => {
    const posix = planAgentBinary('claude', WINDOWS_BINARY)
    const literal = planAgentBinary('claude', WINDOWS_BINARY, 'literal')

    // The bug: POSIX escaping eats every separator, so the binary is not found.
    expect(posix.ok && posix.binary).toBe('C:WindowsSystem32WindowsPowerShellv1.0powershell.exe')
    expect(literal.ok && literal.binary).toBe(WINDOWS_BINARY)
  })

  it('keeps a quoted path containing spaces intact in literal mode', () => {
    const literal = planAgentBinary('claude', '"C:\\Program Files\\nodejs\\node.exe"', 'literal')

    expect(literal.ok && literal.binary).toBe('C:\\Program Files\\nodejs\\node.exe')
  })

  it('keeps extra CLI args intact through planCommitMessageGeneration', () => {
    const plan = planCommitMessageGeneration(
      {
        agentId: 'claude',
        model: 'sonnet',
        agentCommandOverride: WINDOWS_BINARY,
        agentArgs: '--config C:\\Users\\me\\.claude.json',
        backslash: 'literal'
      },
      'prompt'
    )

    expect(plan.ok && plan.plan.binary).toBe(WINDOWS_BINARY)
    expect(plan.ok && plan.plan.args).toContain('C:\\Users\\me\\.claude.json')
  })

  it('defaults to POSIX escaping when no mode is given', () => {
    const plan = planCommitMessageGeneration(
      { agentId: 'claude', model: 'sonnet', agentArgs: '--dir /my\\ dir' },
      'prompt'
    )

    expect(plan.ok && plan.plan.args).toContain('/my dir')
  })
})
