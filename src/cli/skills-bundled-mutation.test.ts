import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { join, resolve } from 'node:path'
const { mutate, detect, spawn } = vi.hoisted(() => ({
  mutate: vi.fn(),
  detect: vi.fn(),
  spawn: vi.fn()
}))
vi.mock('../main/skills/bundled-agent-skill-install.js', () => ({
  mutateBundledAgentSkills: mutate
}))
vi.mock('../shared/local-agent-install-dir-detection', () => ({
  detectCommandsInInstallDirs: detect
}))
vi.mock('node:child_process', () => ({ spawn }))
import { main } from './index'

describe('bundled skills mutation CLI', () => {
  beforeEach(() => {
    vi.stubEnv('ORCA_CLI_CWD', '')
    vi.stubEnv('ORCA_USER_DATA_PATH', '/fixture/kondex-state')
    vi.stubEnv('CLAUDE_CONFIG_DIR', '/fixture/custom-claude')
    detect.mockReset().mockReturnValue(new Set(['claude', 'codex']))
    mutate.mockReset().mockResolvedValue({
      status: 'complete',
      skills: [{ name: 'kondex-cli', status: 'installed' }],
      skippedSkills: []
    })
    spawn.mockReset()
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    process.exitCode = undefined
  })
  afterEach(() => {
    expect(spawn).not.toHaveBeenCalled()
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    process.exitCode = undefined
  })

  it.each([false, true])(
    'uses the local bundle transaction with project scope=%s',
    async (local) => {
      await main(
        ['skills', 'install', '--skill', 'orca-cli', ...(local ? ['--local'] : []), '--json'],
        '/fixture/workspace'
      )
      expect(mutate).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          verb: 'install',
          skillNames: ['kondex-cli'],
          scope: local ? 'workspace' : 'global',
          providers: ['claude', 'codex'],
          workspaceDirectory: '/fixture/workspace',
          stateDirectory: '/fixture/kondex-state',
          providerRootOverrides: { claude: join(resolve('/fixture/custom-claude'), 'skills') }
        })
      )
      expect(
        JSON.parse(
          vi
            .mocked(process.stdout.write)
            .mock.calls.map(([text]) => text)
            .join('')
        )
      ).toMatchObject({ status: 'complete' })
      expect(process.exitCode).toBe(0)
    }
  )

  it.each([
    ['computer-use', 'kondex-computer-use'],
    ['orchestration', 'kondex-orchestration']
  ])('resolves the legacy %s lookup to %s without mutation', async (alias, name) => {
    await main(['skills', 'get', alias, '--json'], '/fixture/workspace')
    const result = JSON.parse(
      vi
        .mocked(process.stdout.write)
        .mock.calls.map(([text]) => text)
        .join('')
    )
    expect(result.name).toBe(name)
    expect(result.markdown).toContain(`name: ${name}\n`)
    expect(mutate).not.toHaveBeenCalled()
    expect(detect).not.toHaveBeenCalled()
    expect(process.exitCode).toBeUndefined()
  })

  it('deduplicates aliases and preserves repeated skill selections', async () => {
    await main(
      [
        'skills',
        'install',
        '--skill',
        'orca-cli',
        '--skill',
        'kondex-cli',
        '--skill',
        'orchestration'
      ],
      '/fixture/workspace'
    )
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ skillNames: ['kondex-cli', 'kondex-orchestration'] })
    )
  })

  it('shows the actual local operation without writing on dry-run', async () => {
    await main(['skills', 'install', '--all', '--dry-run', '--json'], '/fixture/workspace')
    const result = JSON.parse(
      vi
        .mocked(process.stdout.write)
        .mock.calls.map(([text]) => text)
        .join('')
    )
    expect(result.executed).toBe(false)
    expect(result.command).toContain('kondex skills install')
    expect(result.command).not.toMatch(/npx|https:/)
    expect(mutate).not.toHaveBeenCalled()
  })

  it.each(['codex,claude-code,codex', 'universal'])(
    'honors explicit targets %s without probing',
    async (agent) => {
      await main(
        ['skills', 'install', '--skill', 'kondex-cli', '--agent', agent],
        '/fixture/workspace'
      )
      expect(detect).not.toHaveBeenCalled()
      expect(mutate).toHaveBeenCalledWith(
        expect.objectContaining({ providers: agent === 'universal' ? [] : ['codex', 'claude'] })
      )
    }
  )

  it.each(['', ',', '-y', 'a b', '*', 'gemini', 'unknown'])(
    'rejects invalid or unsupported target %j',
    async (agent) => {
      await main(
        ['skills', 'install', '--skill', 'kondex-cli', `--agent=${agent}`],
        '/fixture/workspace'
      )
      expect(process.exitCode).toBe(1)
      expect(mutate).not.toHaveBeenCalled()
    }
  )

  it('refuses an absent install target', async () => {
    detect.mockReturnValue(new Set())
    await main(['skills', 'install', '--skill', 'kondex-cli'], '/fixture/workspace')
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('No coding agent detected'))
    expect(mutate).not.toHaveBeenCalled()
  })

  it('updates existing placements without detecting or adding agent targets', async () => {
    detect.mockReturnValue(new Set())
    await main(['skills', 'update', '--all', '--json'], '/fixture/workspace')
    expect(detect).not.toHaveBeenCalled()
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ verb: 'update', providers: [] }))
  })

  it.each(['install', 'update'])(
    'rejects a forwarded %s before local target detection',
    async (verb) => {
      vi.stubEnv('ORCA_CLI_CWD', '/forwarded/workspace')
      await main(['skills', verb, '--skill', 'kondex-cli'], '/fixture/workspace')
      expect(process.exitCode).toBe(1)
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('this shell forwards'))
      expect(detect).not.toHaveBeenCalled()
      expect(mutate).not.toHaveBeenCalled()
    }
  )

  it('reports conflicts as non-success instead of claiming installation', async () => {
    mutate.mockResolvedValue({
      status: 'partial',
      skills: [{ name: 'kondex-cli', status: 'kept-local' }],
      skippedSkills: []
    })
    await main(['skills', 'install', '--skill', 'kondex-cli'], '/fixture/workspace')
    expect(process.exitCode).toBe(1)
    expect(vi.mocked(process.stdout.write).mock.calls.flat().join('')).toContain('kept-local')
  })

  it('surfaces transaction failure', async () => {
    mutate.mockRejectedValue(new Error('disk unavailable'))
    await main(['skills', 'install', '--skill', 'kondex-cli'], '/fixture/workspace')
    expect(process.exitCode).toBe(1)
    expect(console.error).toHaveBeenCalledWith('disk unavailable')
  })
})
