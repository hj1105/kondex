import { describe, expect, it } from 'vitest'
import {
  buildAgentDraftLaunchPlan,
  buildAgentResumeStartupPlan,
  buildAgentStartupPlan,
  buildShellCommandFromArgv,
  planAgentCliArgsSuffix
} from './tui-agent-startup'

import { normalizeTuiAgentArgsRecord } from './tui-agent-launch-defaults'

describe('tui agent startup plans', () => {
  it.each(['powershell', 'cmd'] as const)(
    'keeps the established invalid-quote error on %s',
    (shell) => {
      expect(planAgentCliArgsSuffix('--model "unterminated', shell)).toEqual({
        ok: false,
        error: 'CLI arguments are invalid: Unclosed quote in command template.'
      })
    }
  )

  it('uses POSIX quoting when the target shell is Linux', () => {
    const plan = buildAgentStartupPlan({
      agent: 'claude',
      prompt: "fix Bob's branch",
      cmdOverrides: {},
      platform: 'linux'
    })

    expect(plan?.launchCommand).toBe("claude 'fix Bob'\"'\"'s branch'")
  })

  it('uses PowerShell quoting by default when the target shell is Windows', () => {
    const plan = buildAgentStartupPlan({
      agent: 'claude',
      prompt: 'fix Bob\'s "quoted" branch',
      cmdOverrides: {},
      platform: 'win32'
    })

    expect(plan?.launchCommand).toBe("claude 'fix Bob''s \"quoted\" branch'")
  })

  it('invokes fully quoted argv commands in PowerShell', () => {
    expect(buildShellCommandFromArgv(['codex', 'resume', 's1'], 'powershell')).toBe(
      "& 'codex' 'resume' 's1'"
    )
  })

  it('uses cmd escaping when requested explicitly', () => {
    const plan = buildAgentStartupPlan({
      agent: 'claude',
      prompt: 'fix "quoted" & %PATH%',
      cmdOverrides: {},
      platform: 'win32',
      shell: 'cmd'
    })

    expect(plan?.launchCommand).toBe('claude "fix ^"quoted^" ^& ^%PATH^%"')
  })

  it('does not add the Grok prompt separator to other argv agents', () => {
    const plan = buildAgentStartupPlan({
      agent: 'codex',
      prompt: '--version',
      cmdOverrides: {},
      platform: 'linux'
    })

    expect(plan?.launchCommand).toBe("codex '--version'")
  })

  it('does not launch Codex with the Orca profile when agent status hooks are enabled', () => {
    const plan = buildAgentStartupPlan({
      agent: 'codex',
      prompt: 'fix it',
      cmdOverrides: {},
      platform: 'linux'
    })

    expect(plan?.launchCommand).toBe("codex 'fix it'")
    expect(plan?.startupCommandDelivery).toBe('shell-ready')
  })

  it('keeps plain empty Codex startup on the fast delivery path', () => {
    const plan = buildAgentStartupPlan({
      agent: 'codex',
      prompt: '',
      cmdOverrides: {},
      platform: 'linux',
      allowEmptyPromptLaunch: true
    })

    expect(plan).toEqual({
      agent: 'codex',
      launchCommand: 'codex',
      expectedProcess: 'codex',
      followupPrompt: null,
      launchConfig: { agentCommand: 'codex', agentArgs: '', agentEnv: {} }
    })
  })

  it('launches Claude without Orca settings injection', () => {
    const plan = buildAgentStartupPlan({
      agent: 'claude',
      prompt: 'fix it',
      cmdOverrides: {},
      platform: 'linux'
    })

    expect(plan?.launchCommand).toBe("claude 'fix it'")
    expect(plan?.launchCommand).not.toContain('--settings')
  })

  it('leaves Claude command overrides untouched', () => {
    const plan = buildAgentStartupPlan({
      agent: 'claude',
      prompt: 'fix it',
      cmdOverrides: { claude: 'claude --dangerously-skip-permissions' },
      platform: 'linux'
    })

    expect(plan?.launchCommand).toBe("claude --dangerously-skip-permissions 'fix it'")
  })

  it('leaves Codex command overrides untouched', () => {
    const plan = buildAgentStartupPlan({
      agent: 'codex',
      prompt: 'fix it',
      cmdOverrides: { codex: 'codex --profile work' },
      platform: 'linux'
    })

    expect(plan?.launchCommand).toBe("codex --profile work 'fix it'")
  })

  it('builds Windows resume plans that PowerShell can invoke', () => {
    const plan = buildAgentResumeStartupPlan({
      agent: 'codex',
      providerSession: { key: 'session_id', id: 's1' },
      cmdOverrides: {},
      platform: 'win32'
    })

    expect(plan?.launchCommand).toBe("codex 'resume' 's1'")
    expect(plan?.startupCommandDelivery).toBe('shell-ready')
  })

  it('quotes Windows resume argv for cmd.exe when shell is cmd', () => {
    const plan = buildAgentResumeStartupPlan({
      agent: 'claude',
      providerSession: { key: 'session_id', id: '019fc272-80fa-7a91-80a2-9c461ef1a9da' },
      cmdOverrides: {},
      agentArgs: '--permission-mode bypassPermissions',
      platform: 'win32',
      shell: 'cmd'
    })

    // Why: cmd.exe treats single quotes as literal characters. Resume must use
    // double quotes (or unquoted tokens) so the CLI receives clean argv.
    expect(plan?.launchCommand).toBe(
      'claude "--permission-mode" "bypassPermissions" "--resume" "019fc272-80fa-7a91-80a2-9c461ef1a9da"'
    )
  })

  it('keeps cmd-quoted agentCommand aligned with cmd resume suffix', () => {
    const plan = buildAgentResumeStartupPlan({
      agent: 'claude',
      providerSession: { key: 'session_id', id: '019fc272-80fa-7a91-80a2-9c461ef1a9da' },
      cmdOverrides: {},
      agentCommand: 'claude "--permission-mode" "bypassPermissions"',
      platform: 'win32',
      shell: 'cmd'
    })

    // Regression: agentCommand from a prior cmd launch + PowerShell-default resume
    // suffix produced mixed quoting and broke reboot restore on cmd.exe tabs.
    expect(plan?.launchCommand).toBe(
      'claude "--permission-mode" "bypassPermissions" "--resume" "019fc272-80fa-7a91-80a2-9c461ef1a9da"'
    )
  })

  it('honors command overrides when building POSIX resume plans', () => {
    const plan = buildAgentResumeStartupPlan({
      agent: 'codex',
      providerSession: { key: 'session_id', id: 's1' },
      cmdOverrides: { codex: 'codex --profile work' },
      platform: 'linux'
    })

    expect(plan?.launchCommand).toBe("codex --profile work 'resume' 's1'")
  })

  it('uses a captured launch command when building resume plans after overrides change', () => {
    const plan = buildAgentResumeStartupPlan({
      agent: 'codex',
      providerSession: { key: 'session_id', id: 's1' },
      cmdOverrides: { codex: 'codex --profile changed' },
      agentCommand: 'codex --profile captured',
      platform: 'linux'
    })

    expect(plan?.launchCommand).toBe("codex --profile captured 'resume' 's1'")
    expect(plan?.launchConfig).toEqual({
      agentCommand: 'codex --profile captured',
      agentArgs: '',
      agentEnv: {}
    })
  })

  it('appends shell-quoted CLI arguments before prompt delivery flags', () => {
    const plan = buildAgentStartupPlan({
      agent: 'claude',
      prompt: 'fix it',
      cmdOverrides: {},
      agentArgs: '--model sonnet --add-dir "path with spaces"',
      platform: 'linux'
    })

    expect(plan?.launchCommand).toBe(
      "claude '--model' 'sonnet' '--add-dir' 'path with spaces' 'fix it'"
    )
  })

  it('uses PowerShell quoting for CLI arguments on Windows', () => {
    const plan = buildAgentStartupPlan({
      agent: 'claude',
      prompt: 'fix it',
      cmdOverrides: {},
      agentArgs: '--model sonnet --name "Bob\'s"',
      platform: 'win32'
    })

    expect(plan?.launchCommand).toBe("claude '--model' 'sonnet' '--name' 'Bob''s' 'fix it'")
  })

  it('carries agent launch environment defaults into startup plans', () => {
    const plan = buildAgentStartupPlan({
      agent: 'codex',
      prompt: '',
      cmdOverrides: {},
      agentEnv: { KONDEX_TEST_MODE: 'auto' },
      platform: 'linux',
      allowEmptyPromptLaunch: true
    })

    expect(plan?.launchCommand).toBe('codex')
    expect(plan?.env).toEqual({ KONDEX_TEST_MODE: 'auto' })
    expect(plan?.launchConfig).toEqual({
      agentCommand: 'codex',
      agentArgs: '',
      agentEnv: { KONDEX_TEST_MODE: 'auto' }
    })
  })

  it('captures empty args and env as explicit launch config values', () => {
    const plan = buildAgentStartupPlan({
      agent: 'claude',
      prompt: '',
      cmdOverrides: {},
      agentArgs: '',
      agentEnv: {},
      platform: 'linux',
      allowEmptyPromptLaunch: true
    })

    expect(plan?.launchConfig).toEqual({ agentCommand: 'claude', agentArgs: '', agentEnv: {} })
  })

  it('does not append the unsupported OpenCode TUI skip-permissions arg', () => {
    const agentDefaultArgs = normalizeTuiAgentArgsRecord({
      opencode: '--dangerously-skip-permissions'
    })
    expect(agentDefaultArgs).toEqual({})
  })

  it('returns null for oversized Windows flag drafts so callers paste after ready', () => {
    expect(
      buildAgentDraftLaunchPlan({
        agent: 'claude',
        draft: 'x'.repeat(25_000),
        cmdOverrides: {},
        platform: 'win32'
      })
    ).toBeNull()
  })

  it('does not persist draft text in the captured launch configuration', () => {
    const plan = buildAgentDraftLaunchPlan({
      agent: 'claude',
      draft: 'prefill text',
      cmdOverrides: {},
      agentEnv: { ORCA_AGENT_MODE: 'managed' },
      platform: 'linux'
    })

    expect(plan?.env).toEqual({ ORCA_AGENT_MODE: 'managed' })
    expect(plan?.launchConfig).toEqual({
      agentCommand: 'claude',
      agentArgs: '',
      agentEnv: { ORCA_AGENT_MODE: 'managed' }
    })
  })
})
