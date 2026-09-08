import { describe, expect, it } from 'vitest'

import {
  buildAiVaultResumeCommand,
  buildAiVaultResumeShellCommand
} from './ai-vault-resume-command'

describe('buildAiVaultResumeCommand', () => {
  it('builds a self-contained cmd wrapper when no live shell is known', () => {
    expect(
      buildAiVaultResumeCommand({
        agent: 'codex',
        sessionId: 'session-1',
        cwd: 'C:\\Users\\Ada Lovelace\\repo',
        platform: 'win32'
      })
    ).toBe('cmd /d /s /c "cd /d ""C:\\Users\\Ada Lovelace\\repo"" && codex resume ""session-1"""')
  })

  it('builds a direct queued command for a live cmd shell', () => {
    expect(
      buildAiVaultResumeCommand({
        agent: 'claude',
        sessionId: 'session-one',
        cwd: 'C:\\Users\\Ada Lovelace\\A&B repo',
        platform: 'win32',
        shell: 'cmd'
      })
    ).toBe('cd /d "C:\\Users\\Ada Lovelace\\A&B repo" && claude --resume "session-one"')
  })

  it('emits no CODEX_HOME stamp for real-home canonical sessions', () => {
    // Backfilled sessions dedupe to the real-home row (codexHome null); their
    // resume must run against the user's own ~/.codex, never the frozen
    // managed home whose auth.json stops refreshing after the flip.
    const command = buildAiVaultResumeCommand({
      agent: 'codex',
      sessionId: 'session-1',
      cwd: '/repo/app',
      platform: 'darwin',
      codexHome: null
    })
    expect(command).toBe("cd '/repo/app' && codex resume 'session-1'")
    expect(command).not.toContain('CODEX_HOME')
  })

  it('carries non-default Codex homes in copied resume commands', () => {
    expect(
      buildAiVaultResumeCommand({
        agent: 'codex',
        sessionId: 'session-1',
        cwd: '/repo/app',
        platform: 'darwin',
        codexHome: '/Users/ada/Library/Application Support/Orca/codex-runtime-home/home'
      })
    ).toBe(
      "cd '/repo/app' && CODEX_HOME='/Users/ada/Library/Application Support/Orca/codex-runtime-home/home' codex resume 'session-1'"
    )

    expect(
      buildAiVaultResumeCommand({
        agent: 'codex',
        sessionId: 'session-1',
        cwd: 'C:\\Users\\Ada Lovelace\\repo',
        platform: 'win32',
        codexHome: 'C:\\Users\\Ada\\AppData\\Roaming\\Orca\\codex-runtime-home\\home'
      })
    ).toBe(
      'cmd /d /s /c "cd /d ""C:\\Users\\Ada Lovelace\\repo"" && set ""CODEX_HOME=C:\\Users\\Ada\\AppData\\Roaming\\Orca\\codex-runtime-home\\home"" && codex resume ""session-1"""'
    )
  })
})

describe('buildAiVaultResumeShellCommand env removal', () => {
  const base = {
    resumeCommand: "codex 'resume' 'sid'",
    cwd: '/repo',
    clearEnvNames: ['CODEX_HOME', 'ORCA_CODEX_HOME']
  }

  it('carries the removal on the agent under a POSIX shell', () => {
    expect(buildAiVaultResumeShellCommand({ ...base, platform: 'darwin' })).toBe(
      "cd '/repo' && env -u CODEX_HOME -u ORCA_CODEX_HOME codex 'resume' 'sid'"
    )
  })

  // Why: `env -u` strips what the assignment just set, so an unfiltered list
  // would silently resume against the real home instead of the pinned one.
  it('keeps a pinned CODEX_HOME authoritative instead of stripping it', () => {
    const command = buildAiVaultResumeShellCommand({
      ...base,
      platform: 'darwin',
      codexHome: '/home/a/.codex-work'
    })

    expect(command).toBe(
      "cd '/repo' && CODEX_HOME='/home/a/.codex-work' env -u ORCA_CODEX_HOME codex 'resume' 'sid'"
    )
    expect(command).not.toContain('-u CODEX_HOME')
  })

  it('keeps a pinned CODEX_HOME authoritative under a git-bash shell too', () => {
    expect(
      buildAiVaultResumeShellCommand({
        ...base,
        platform: 'win32',
        shell: 'posix',
        codexHome: '/c/users/a/.codex-work'
      })
    ).toBe(
      "cd '/repo' && CODEX_HOME='/c/users/a/.codex-work' env -u ORCA_CODEX_HOME codex 'resume' 'sid'"
    )
  })

  // Why: the shell decides the grammar, not the host. Keying placement on the
  // platform emitted POSIX `env -u` into a PowerShell line.
  it('uses PowerShell grammar for a PowerShell shell on a non-Windows host', () => {
    const command = buildAiVaultResumeShellCommand({
      ...base,
      platform: 'linux',
      shell: 'powershell'
    })

    expect(command).not.toContain('env -u')
    expect(command).toBe(
      'Remove-Item Env:CODEX_HOME -ErrorAction SilentlyContinue; ' +
        'Remove-Item Env:ORCA_CODEX_HOME -ErrorAction SilentlyContinue; ' +
        "Set-Location -LiteralPath '/repo'; codex 'resume' 'sid'"
    )
  })

  it('keeps the cmd clear ahead of the cd so a failed cd cannot launch the agent', () => {
    expect(
      buildAiVaultResumeShellCommand({
        ...base,
        cwd: 'C:\\repo',
        platform: 'win32',
        shell: 'cmd'
      })
    ).toBe(
      'set "CODEX_HOME=" & set "ORCA_CODEX_HOME=" & cd /d "C:\\repo" && codex \'resume\' \'sid\''
    )
  })
})
