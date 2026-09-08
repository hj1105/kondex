import { describe, expect, it } from 'vitest'
import {
  buildAgentDraftLaunchPlan,
  buildAgentStartupPlan,
  isShellProcess
} from './tui-agent-startup'

const emptyLaunchConfig = (agentCommand: string) => ({
  agentCommand,
  agentArgs: '',
  agentEnv: {}
})

describe('buildAgentStartupPlan', () => {
  it('passes Claude prompts as a positional interactive argument', () => {
    expect(
      buildAgentStartupPlan({
        agent: 'claude',
        prompt: 'Fix the bug',
        cmdOverrides: {},
        platform: 'darwin'
      })
    ).toEqual({
      agent: 'claude',
      launchCommand: "claude 'Fix the bug'",
      expectedProcess: 'claude',
      followupPrompt: null,
      launchConfig: emptyLaunchConfig('claude')
    })
  })

  it('applies command overrides without changing the prompt syntax contract', () => {
    expect(
      buildAgentStartupPlan({
        agent: 'codex',
        prompt: 'Ship the fix',
        cmdOverrides: { codex: '/opt/codex/bin/codex' },
        platform: 'linux'
      })
    ).toEqual({
      agent: 'codex',
      launchCommand: "/opt/codex/bin/codex 'Ship the fix'",
      expectedProcess: 'codex',
      followupPrompt: null,
      startupCommandDelivery: 'shell-ready',
      launchConfig: emptyLaunchConfig('/opt/codex/bin/codex')
    })
  })

  it('returns null when there is no prompt to inject', () => {
    expect(
      buildAgentStartupPlan({
        agent: 'codex',
        prompt: '   ',
        cmdOverrides: {},
        platform: 'darwin'
      })
    ).toBeNull()
  })
})

describe('buildAgentDraftLaunchPlan', () => {
  it('uses Claude --prefill to seed the input box without submitting', () => {
    expect(
      buildAgentDraftLaunchPlan({
        agent: 'claude',
        draft: 'https://github.com/acme/repo/issues/42',
        cmdOverrides: {},
        platform: 'darwin'
      })
    ).toEqual({
      agent: 'claude',
      launchCommand: "claude --prefill 'https://github.com/acme/repo/issues/42'",
      expectedProcess: 'claude',
      launchConfig: emptyLaunchConfig('claude')
    })
  })

  it('returns null for agents without a documented prefill flag', () => {
    expect(
      buildAgentDraftLaunchPlan({
        agent: 'codex',
        draft: 'https://github.com/acme/repo/issues/42',
        cmdOverrides: {},
        platform: 'darwin'
      })
    ).toBeNull()
  })

  it('returns null for an empty draft so callers fall back cleanly', () => {
    expect(
      buildAgentDraftLaunchPlan({
        agent: 'claude',
        draft: '   ',
        cmdOverrides: {},
        platform: 'darwin'
      })
    ).toBeNull()
  })

  it('honors cmdOverrides so custom Claude install paths still prefill', () => {
    expect(
      buildAgentDraftLaunchPlan({
        agent: 'claude',
        draft: 'review this',
        cmdOverrides: { claude: '/opt/anthropic/bin/claude' },
        platform: 'linux'
      })
    ).toEqual({
      agent: 'claude',
      launchCommand: "/opt/anthropic/bin/claude --prefill 'review this'",
      expectedProcess: 'claude',
      launchConfig: emptyLaunchConfig('/opt/anthropic/bin/claude')
    })
  })
})

describe('isShellProcess', () => {
  it('treats common shells as non-agent foreground processes', () => {
    expect(isShellProcess('bash')).toBe(true)
    expect(isShellProcess('C:\\Program Files\\Git\\bin\\bash.exe')).toBe(true)
    expect(isShellProcess('pwsh.exe')).toBe(true)
    expect(isShellProcess('/bin/zsh')).toBe(true)
    expect(isShellProcess('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe')).toBe(
      true
    )
    expect(isShellProcess('')).toBe(true)
  })

  it('does not confuse agent processes with the host shell', () => {
    expect(isShellProcess('claude')).toBe(false)
    expect(isShellProcess('codex')).toBe(false)
  })
})
