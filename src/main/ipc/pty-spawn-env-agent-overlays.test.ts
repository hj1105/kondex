import { describe, expect, it, vi } from 'vitest'
import { readFileSyncMock, spawnMock } from './pty-ipc-mock-registry'
import { posixOnlyIt } from './pty-ipc-test-constants'
import { setupPtyIpcSuite } from './pty-ipc-test-harness'
import type { TuiAgent } from '../../shared/tui-agent'
import { SETUP_AGENT_SEQUENCE_STARTUP_COMMAND_ENV } from '../../shared/setup-agent-sequencing'

vi.mock('electron', () => import('./pty-ipc-mock-registry').then((m) => m.electronModuleMock()))
vi.mock('fs', () => import('./pty-ipc-mock-registry').then((m) => m.fsModuleMock()))
vi.mock('node-pty', () => import('./pty-ipc-mock-registry').then((m) => m.nodePtyModuleMock()))
vi.mock('node:child_process', async (importOriginal) =>
  (await import('./pty-ipc-mock-registry')).childProcessModuleMock(await importOriginal())
)
vi.mock('../agent-hooks/server', () =>
  import('./pty-ipc-mock-registry').then((m) => m.agentHookServerModuleMock())
)
vi.mock('../pwsh', () => import('./pty-ipc-mock-registry').then((m) => m.pwshModuleMock()))
vi.mock('../wsl', async (importOriginal) =>
  (await import('./pty-ipc-mock-registry')).wslModuleMock(await importOriginal())
)
vi.mock('../cli/linux-terminal-orca-cli-shim', () =>
  import('./pty-ipc-mock-registry').then((m) => m.linuxCliShimModuleMock())
)
vi.mock('../memory/pty-registry', () =>
  import('./pty-ipc-mock-registry').then((m) => m.ptyRegistryModuleMock())
)
vi.mock('../agent-hooks/migration-unsupported-pty-state', () =>
  import('./pty-ipc-mock-registry').then((m) => m.migrationUnsupportedPtyModuleMock())
)
vi.mock('../codex/codex-pane-account-registry', () =>
  import('./pty-ipc-mock-registry').then((m) => m.codexPaneAccountRegistryModuleMock())
)
vi.mock('../codex/codex-state-db-backfill-recovery', () =>
  import('./pty-ipc-mock-registry').then((m) => m.codexBackfillRecoveryModuleMock())
)

describe('registerPtyHandlers', () => {
  const { spawnAndGetEnv } = setupPtyIpcSuite()

  describe('spawn environment', () => {
    it('prepares Codex launch state for the workspace before spawning an interactive tab', async () => {
      const workspacePath = '/repo/worktrees/new-feature'
      const resolveHome = vi.fn(
        (
          _target?: { runtime?: 'host' | 'wsl'; wslDistro?: string | null },
          _launchEnv?: NodeJS.ProcessEnv,
          _launchContext?: { workspacePath?: string; launchAgent?: TuiAgent }
        ) => null
      )

      await spawnAndGetEnv(
        undefined,
        undefined,
        resolveHome,
        undefined,
        'codex',
        'codex',
        workspacePath,
        `repo-id::${workspacePath}`
      )

      expect(resolveHome.mock.calls[0]?.[0]).toEqual({ runtime: 'host' })
      expect(resolveHome.mock.calls[0]?.[2]).toEqual({ workspacePath, launchAgent: 'codex' })
      expect(resolveHome.mock.invocationCallOrder[0]).toBeLessThan(
        spawnMock.mock.invocationCallOrder[0]!
      )
    })

    it('preserves explicit retired OpenCode env without creating an overlay', async () => {
      const env = await spawnAndGetEnv({
        OPENCODE_CONFIG_DIR: '/tmp/parent-orca-opencode-overlay',
        ORCA_OPENCODE_CONFIG_DIR: '/tmp/parent-orca-opencode-overlay'
      })

      expect(env.OPENCODE_CONFIG_DIR).toBe('/tmp/parent-orca-opencode-overlay')
      expect(env.ORCA_OPENCODE_CONFIG_DIR).toBe('/tmp/parent-orca-opencode-overlay')
      expect(env.ORCA_OPENCODE_SOURCE_CONFIG_DIR).toBeUndefined()
    })

    it('does not inject a retired MiMo overlay on explicit launch', async () => {
      const env = await spawnAndGetEnv(undefined, undefined, undefined, undefined, 'mimo')

      expect(env.MIMOCODE_HOME).toBeUndefined()
      expect(env.ORCA_MIMOCODE_HOME).toBeUndefined()
      expect(env.ORCA_MIMOCODE_SOURCE_HOME).toBeUndefined()
    })
    it.each(['/usr/local/bin/mimo --prompt hi', '"C:\\Program Files\\MiMo\\mimo.cmd" --prompt hi'])(
      'does not inject a retired MiMo overlay for path-qualified command %s',
      async (launchCommand) => {
        const env = await spawnAndGetEnv(undefined, undefined, undefined, undefined, launchCommand)

        expect(env.MIMOCODE_HOME).toBeUndefined()
        expect(env.ORCA_MIMOCODE_HOME).toBeUndefined()
      }
    )
    it('does not inject retired MiMo overlays through sequenced startup', async () => {
      const env = await spawnAndGetEnv(
        { [SETUP_AGENT_SEQUENCE_STARTUP_COMMAND_ENV]: 'mimo --prompt hi' },
        undefined,
        undefined,
        undefined,
        'bash -lc wait-wrapper'
      )

      expect(env.MIMOCODE_HOME).toBeUndefined()
      expect(env.ORCA_MIMOCODE_HOME).toBeUndefined()
    })
    it('does not inject MiMo overlay for non-mimo launches', async () => {
      const env = await spawnAndGetEnv()
      expect(env.MIMOCODE_HOME).toBeUndefined()
      expect(env.ORCA_MIMOCODE_HOME).toBeUndefined()
    })
    it('preserves explicit MiMo env when hooks are disabled without remapping it', async () => {
      const env = await spawnAndGetEnv(
        {
          MIMOCODE_HOME: '/tmp/parent-orca-mimocode-overlay',
          ORCA_MIMOCODE_HOME: '/tmp/parent-orca-mimocode-overlay',
          ORCA_MIMOCODE_SOURCE_HOME: '/tmp/user-mimocode-home'
        },
        undefined,
        undefined,
        () => ({ agentStatusHooksEnabled: false }),
        'mimo'
      )

      expect(env.MIMOCODE_HOME).toBe('/tmp/parent-orca-mimocode-overlay')
      expect(env.ORCA_MIMOCODE_HOME).toBe('/tmp/parent-orca-mimocode-overlay')
      expect(env.ORCA_MIMOCODE_SOURCE_HOME).toBe('/tmp/user-mimocode-home')
    })
    posixOnlyIt(
      'does not read shell-only OpenCode config to synthesize a retired overlay',
      async () => {
        // Why: the reporter's app didn't inherit OPENCODE_CONFIG_DIR; their interactive zsh later exported a company config repo.
        readFileSyncMock.mockImplementation((path: string) => {
          if (path.endsWith('.zshrc')) {
            return [
              '# Company-wide OpenCode config loaded by interactive shells',
              'export OPENCODE_CONFIG_DIR="$HOME/company/opencode-config"',
              ''
            ].join('\n')
          }
          return ''
        })

        const env = await spawnAndGetEnv(undefined, {
          HOME: '/home/pim',
          SHELL: '/bin/zsh',
          OPENCODE_CONFIG_DIR: undefined,
          ORCA_OPENCODE_SOURCE_CONFIG_DIR: undefined
        })

        expect(env.OPENCODE_CONFIG_DIR).toBeUndefined()
        expect(env.ORCA_OPENCODE_CONFIG_DIR).toBeUndefined()
        expect(env.ORCA_OPENCODE_SOURCE_CONFIG_DIR).toBeUndefined()
      }
    )

    it('preserves independent user Prime and Pi homes without installing retired status', async () => {
      const env = await spawnAndGetEnv(
        undefined,
        {
          PI_CODING_AGENT_DIR: '/tmp/user-pi-agent',
          PRIME_AGENT_CODING_AGENT_DIR: '/tmp/user-prime-agent'
        },
        undefined,
        undefined,
        'prime-agent'
      )

      expect(env.PRIME_AGENT_CODING_AGENT_DIR).toBe('/tmp/user-prime-agent')
      expect(env.PI_CODING_AGENT_DIR).toBe('/tmp/user-pi-agent')
      expect(env.ORCA_PRIME_AGENT_SOURCE_AGENT_DIR).toBeUndefined()
      expect(env.ORCA_PI_SOURCE_AGENT_DIR).toBeUndefined()
      expect(env.ORCA_OMP_SOURCE_AGENT_DIR).toBeUndefined()
    })
  })
})
