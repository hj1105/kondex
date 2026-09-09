import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { validateAiVaultSessionDeleteTarget } from './session-delete-target'

// All roots are supplied via rootOptions so these tests never touch the real
// home directory or filesystem — validation is pure string-path judgement.
const HOME = join('/tmp', 'orca-ai-vault-delete-fixture-home')
const CLAUDE_ROOT = join(HOME, '.claude', 'projects')
const CLAUDE_SESSION_ENV_ROOT = join(HOME, '.claude', 'session-env')

describe('validateAiVaultSessionDeleteTarget', () => {
  it('allows a supported agent whose file resolves inside its known root', () => {
    const result = validateAiVaultSessionDeleteTarget({
      agent: 'claude',
      filePath: join(CLAUDE_ROOT, 'project-a', 'session-1.jsonl'),
      executionHostId: 'local',
      rootOptions: { claudeProjectsDir: CLAUDE_ROOT }
    })
    expect(result).toEqual({
      allowed: true,
      agent: 'claude',
      resolvedPath: join(CLAUDE_ROOT, 'project-a', 'session-1.jsonl'),
      removals: [
        {
          path: join(CLAUDE_ROOT, 'project-a', 'session-1'),
          kind: 'directory',
          roots: [CLAUDE_ROOT]
        },
        {
          path: join(CLAUDE_SESSION_ENV_ROOT, 'session-1'),
          kind: 'directory',
          roots: [CLAUDE_SESSION_ENV_ROOT]
        },
        {
          path: join(CLAUDE_ROOT, 'project-a', 'session-1.jsonl'),
          kind: 'file',
          roots: [CLAUDE_ROOT]
        }
      ]
    })
  })

  it('rejects a path that escapes its root via ..', () => {
    const result = validateAiVaultSessionDeleteTarget({
      agent: 'claude',
      filePath: join(CLAUDE_ROOT, '..', '..', '..', 'etc', 'passwd.json'),
      executionHostId: 'local',
      rootOptions: { claudeProjectsDir: CLAUDE_ROOT }
    })
    expect(result).toEqual({ allowed: false, agent: 'claude', reason: 'path-outside-known-roots' })
  })

  it('rejects a path entirely outside the known roots', () => {
    const result = validateAiVaultSessionDeleteTarget({
      agent: 'claude',
      filePath: join(HOME, 'Documents', 'notes.json'),
      executionHostId: 'local',
      rootOptions: { claudeProjectsDir: CLAUDE_ROOT }
    })
    expect(result).toEqual({ allowed: false, agent: 'claude', reason: 'path-outside-known-roots' })
  })

  it('rejects a file whose extension the agent never discovers', () => {
    const result = validateAiVaultSessionDeleteTarget({
      agent: 'claude',
      filePath: join(CLAUDE_ROOT, 'proj', 'agent-transcripts', 'session-1.txt'),
      executionHostId: 'local',
      rootOptions: { claudeProjectsDir: CLAUDE_ROOT }
    })
    expect(result).toEqual({ allowed: false, agent: 'claude', reason: 'undiscoverable-path' })
  })

  // Codex writes the same session under the user's ~/.codex and the Kondex-owned
  // runtime home, so deleting only the scanned copy would let its twin list again.
  it('plans a codex delete across every codex home', () => {
    const codexSessionsDir = join(HOME, '.codex', 'sessions')
    const runtimeSessionsDir = join(HOME, 'runtime-codex', 'sessions')
    const relativePath = join('2026', '06', '12', 'rollout-1.jsonl')
    const result = validateAiVaultSessionDeleteTarget({
      agent: 'codex',
      filePath: join(codexSessionsDir, relativePath),
      executionHostId: 'local',
      rootOptions: { codexSessionsDir, codexRuntimeHomeSessionsDir: runtimeSessionsDir }
    })
    expect(result).toMatchObject({ allowed: true, agent: 'codex' })
    expect(result.allowed && result.removals.map((removal) => removal.path)).toEqual([
      join(codexSessionsDir, relativePath),
      join(runtimeSessionsDir, relativePath)
    ])
  })

  it('rejects an agent the vault does not delete', () => {
    const result = validateAiVaultSessionDeleteTarget({
      agent: 'opencode' as never,
      filePath: join(HOME, '.opencode', 'sessions', 'session-1.json'),
      executionHostId: 'local'
    })
    expect(result).toEqual({ allowed: false, agent: 'opencode', reason: 'unsupported-agent' })
  })

  it('rejects a non-local execution host', () => {
    const result = validateAiVaultSessionDeleteTarget({
      agent: 'claude',
      filePath: join(CLAUDE_ROOT, 'project-a', 'session-1.jsonl'),
      executionHostId: 'ssh:some-host',
      rootOptions: { claudeProjectsDir: CLAUDE_ROOT }
    })
    expect(result).toEqual({ allowed: false, agent: 'claude', reason: 'non-local-host' })
  })

  // A real OpenCode SQLite-row session (the `<dbPath>#<sessionId>` identity)
  // reaches the validator as agent 'opencode', which is stopped at the agent
  // gate — so this is how such a session actually enters judgement.

  // Defense-in-depth: even for a deletable agent, any '#'-bearing path is
  // treated as a synthetic SQLite identity rather than a real file to delete.
  it('rejects a deletable-agent path bearing a synthetic # marker', () => {
    const result = validateAiVaultSessionDeleteTarget({
      agent: 'claude',
      filePath: join(CLAUDE_ROOT, 'project-a', 'db.sqlite#session-1'),
      executionHostId: 'local',
      rootOptions: { claudeProjectsDir: CLAUDE_ROOT }
    })
    expect(result).toEqual({ allowed: false, agent: 'claude', reason: 'synthetic-path' })
  })

  it('rejects a blank filePath', () => {
    const result = validateAiVaultSessionDeleteTarget({
      agent: 'claude',
      filePath: '   ',
      executionHostId: 'local',
      rootOptions: { claudeProjectsDir: CLAUDE_ROOT }
    })
    expect(result).toEqual({ allowed: false, agent: 'claude', reason: 'invalid-path' })
  })

  // Discovery matches extensions case-insensitively (walkSessionFiles folds via
  // toLowerCase); the validator must accept the same uppercase-extension file.
  it('allows an uppercase extension since discovery folds extension case', () => {
    const result = validateAiVaultSessionDeleteTarget({
      agent: 'claude',
      filePath: join(CLAUDE_ROOT, 'project-a', 'session-1.JSONL'),
      executionHostId: 'local',
      rootOptions: { claudeProjectsDir: CLAUDE_ROOT }
    })
    expect(result.allowed).toBe(true)
  })

  // A stateDir that already ends in `agents` must not be doubled to
  // `agents/agents`; openClawAgentsRootDir uses it as-is.
})

// The directory-shaped agents. Their delete unit is a path set derived from the
// one file discovery surfaced, not that file alone.
describe('directory-shaped agents', () => {
  it('plans claude companions before the transcript, so a failure keeps the row', () => {
    const filePath = join(CLAUDE_ROOT, '-proj', 'sess-1.jsonl')
    const result = validateAiVaultSessionDeleteTarget({
      agent: 'claude',
      filePath,
      executionHostId: 'local',
      rootOptions: { claudeProjectsDir: CLAUDE_ROOT }
    })

    expect(result).toEqual({
      allowed: true,
      agent: 'claude',
      resolvedPath: filePath,
      removals: [
        {
          path: join(CLAUDE_ROOT, '-proj', 'sess-1'),
          kind: 'directory',
          roots: [CLAUDE_ROOT]
        },
        {
          path: join(CLAUDE_SESSION_ENV_ROOT, 'sess-1'),
          kind: 'directory',
          roots: [CLAUDE_SESSION_ENV_ROOT]
        },
        { path: filePath, kind: 'file', roots: [CLAUDE_ROOT] }
      ]
    })
  })

  it("never plans file-history, the rewind buffer for the user's own files", () => {
    const result = validateAiVaultSessionDeleteTarget({
      agent: 'claude',
      filePath: join(CLAUDE_ROOT, '-proj', 'sess-1.jsonl'),
      executionHostId: 'local',
      rootOptions: { claudeProjectsDir: CLAUDE_ROOT }
    })

    expect(result.allowed).toBe(true)
    expect(
      result.allowed && result.removals.some((removal) => removal.path.includes('file-history'))
    ).toBe(false)
  })

  it("pairs a WSL-home claude session with that distro's session-env, not the local one", () => {
    const wslHome = join('/tmp', 'orca-wsl-home')
    const filePath = join(wslHome, '.claude', 'projects', '-proj', 'sess-2.jsonl')
    const result = validateAiVaultSessionDeleteTarget({
      agent: 'claude',
      filePath,
      executionHostId: 'local',
      wslHomeDirs: [wslHome],
      rootOptions: { claudeProjectsDir: CLAUDE_ROOT }
    })

    expect(result.allowed && result.removals[1]).toEqual({
      path: join(wslHome, '.claude', 'session-env', 'sess-2'),
      kind: 'directory',
      roots: [join(wslHome, '.claude', 'session-env')]
    })
  })

  it('refuses a transcript whose stem would resolve to the project dir itself', () => {
    const result = validateAiVaultSessionDeleteTarget({
      agent: 'claude',
      filePath: join(CLAUDE_ROOT, '-proj', '..jsonl'),
      executionHostId: 'local',
      rootOptions: { claudeProjectsDir: CLAUDE_ROOT }
    })

    expect(result).toEqual({
      allowed: false,
      agent: 'claude',
      reason: 'no-session-directory'
    })
  })

  it('rejects a Task subagent transcript, which is only ever removed with its parent', () => {
    const result = validateAiVaultSessionDeleteTarget({
      agent: 'claude',
      filePath: join(CLAUDE_ROOT, '-proj', 'sess-1', 'subagents', 'agent-abc.jsonl'),
      executionHostId: 'local',
      rootOptions: { claudeProjectsDir: CLAUDE_ROOT }
    })

    expect(result).toEqual({
      allowed: false,
      agent: 'claude',
      reason: 'undiscoverable-path'
    })
  })
})
