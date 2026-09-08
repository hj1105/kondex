import { describe, expect, it } from 'vitest'
import {
  buildManagedHookDetectionCommands,
  detectedManagedHookAgents
} from './managed-hook-detection-commands'

describe('managed hook detection commands', () => {
  it('omits disabled agents and includes safe command overrides', () => {
    const commands = buildManagedHookDetectionCommands(
      {
        disabledTuiAgents: ['claude'],
        agentCmdOverrides: { codex: '/opt/codex custom' }
      },
      'linux'
    )

    expect(commands.some((command) => command.id === 'claude')).toBe(false)
    expect(commands).toContainEqual({ id: 'codex', cmd: '/opt/codex' })
  })

  it('maps detected TUI ids in registry order and excludes retired providers', () => {
    expect(detectedManagedHookAgents(['codex', 'claude', 'opencode', 'droid'])).toEqual([
      'claude',
      'codex'
    ])
  })
})
