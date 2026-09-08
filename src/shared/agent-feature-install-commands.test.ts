import { describe, expect, it } from 'vitest'
import {
  buildAgentFeatureSkillInstallArgs,
  buildAgentFeatureSkillInstallCommand,
  buildAgentFeatureSkillUpdateArgs,
  buildAgentFeatureSkillUpdateCommand,
  ORCA_CLI_SKILL_INSTALL_COMMAND,
  ORCA_CLI_SKILL_UPDATE_COMMAND,
  COMPUTER_USE_SKILL_UPDATE_COMMAND,
  ORCHESTRATION_SKILL_UPDATE_COMMAND,
  ORCA_CLI_ORCHESTRATION_SKILL_INSTALL_COMMAND
} from './agent-feature-install-commands'

describe('native bundled skill commands', () => {
  it('uses the installed Kondex CLI and implicit global scope', () => {
    expect(buildAgentFeatureSkillInstallCommand(['kondex-cli'])).toBe(
      'kondex skills install --skill kondex-cli'
    )
    expect(ORCA_CLI_SKILL_INSTALL_COMMAND).not.toMatch(/npx|https:|--global|-y/)
  })
  it('uses --local explicitly instead of relying on a third-party default', () => {
    expect(buildAgentFeatureSkillInstallCommand(['kondex-cli'], { global: false })).toBe(
      'kondex skills install --skill kondex-cli --local'
    )
    expect(buildAgentFeatureSkillUpdateArgs(['kondex-cli'], { global: false })).toEqual([
      'skills',
      'update',
      '--skill',
      'kondex-cli',
      '--local'
    ])
  })
  it('repeats --skill for both installation and update', () => {
    expect(buildAgentFeatureSkillInstallArgs(['kondex-cli', 'kondex-orchestration'])).toEqual([
      'skills',
      'install',
      '--skill',
      'kondex-cli',
      '--skill',
      'kondex-orchestration'
    ])
    expect(buildAgentFeatureSkillUpdateCommand(['kondex-cli', 'kondex-orchestration'])).toBe(
      'kondex skills update --skill kondex-cli --skill kondex-orchestration'
    )
  })
  it('preserves legacy skill aliases for the CLI to resolve', () => {
    expect(buildAgentFeatureSkillInstallCommand(['orca-cli'])).toBe(
      'kondex skills install --skill orca-cli'
    )
  })
  it('makes unattended targets explicit without unsupported yes flags', () => {
    expect(() => buildAgentFeatureSkillInstallCommand(['kondex-cli'], { yes: true })).toThrow(
      'An install target is required'
    )
    expect(
      buildAgentFeatureSkillInstallCommand(['kondex-cli'], { yes: true, agents: ['universal'] })
    ).toBe('kondex skills install --skill kondex-cli --agent universal')
    expect(buildAgentFeatureSkillUpdateCommand('kondex-cli', { yes: true })).toBe(
      'kondex skills update --skill kondex-cli'
    )
  })
  it.each(['*', '-y', '', 'a b', 'cursor', 'codex;echo unsafe'])(
    'refuses unsupported target %s',
    (agent) => {
      expect(() => buildAgentFeatureSkillInstallArgs(['kondex-cli'], { agents: [agent] })).toThrow(
        'not a usable install target'
      )
    }
  )
  it.each(['', ' ', '--all', '../skill', 'skill;echo unsafe', 'skill\ncommand'])(
    'rejects unsafe names on both command paths: %s',
    (name) => {
      expect(() => buildAgentFeatureSkillInstallCommand([name])).toThrow()
      expect(() => buildAgentFeatureSkillUpdateCommand([name])).toThrow()
    }
  )
  it('trims safe names and refuses an empty selection', () => {
    expect(buildAgentFeatureSkillUpdateCommand(' kondex-cli ')).toBe(
      'kondex skills update --skill kondex-cli'
    )
    expect(() => buildAgentFeatureSkillUpdateCommand([])).toThrow('A skill name is required')
    expect(() => buildAgentFeatureSkillInstallCommand([])).toThrow()
  })
  it('does not change receipt-owned targets during an update', () => {
    expect(() => buildAgentFeatureSkillUpdateCommand('kondex-cli', { agents: ['claude'] })).toThrow(
      'Updates preserve existing installation targets'
    )
  })
  it('exports canonical Kondex names for installation detection and copyable commands', () => {
    expect(ORCA_CLI_SKILL_UPDATE_COMMAND).toBe('kondex skills update --skill kondex-cli')
    expect(COMPUTER_USE_SKILL_UPDATE_COMMAND).toBe(
      'kondex skills update --skill kondex-computer-use'
    )
    expect(ORCHESTRATION_SKILL_UPDATE_COMMAND).toBe(
      'kondex skills update --skill kondex-orchestration'
    )
    expect(ORCA_CLI_ORCHESTRATION_SKILL_INSTALL_COMMAND).toBe(
      buildAgentFeatureSkillInstallCommand(['kondex-cli', 'kondex-orchestration'])
    )
  })
})
