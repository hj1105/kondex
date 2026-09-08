import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from '@/store'
import { resolveBackendDraftStartup } from './worktree-draft-startup-view-mode'

type AppState = ReturnType<typeof useAppStore.getState>

const initialSettings = useAppStore.getState().settings!
const initialRepos = useAppStore.getState().repos

const request = {
  repoId: 'repo-1',
  startup: { launchCommand: 'codex' },
  launchDraftPrompt: 'https://github.com/o/r/issues/12'
} as never

function setRepoConnection(connectionId: string | null): void {
  useAppStore.setState({
    repos: [{ id: 'repo-1', path: '/repo', connectionId }]
  } as unknown as Partial<AppState>)
}

function viewModeFor(agent: string): string | undefined {
  const startup = resolveBackendDraftStartup({ ...(request as object), agent } as never) as
    | { viewMode?: string }
    | undefined
  return startup?.viewMode
}

beforeEach(() => {
  useAppStore.setState({
    settings: {
      ...initialSettings,
      experimentalNativeChat: true,
      openAgentTabsInChatByDefault: true
    }
  })
})

afterEach(() => {
  useAppStore.setState({ settings: initialSettings, repos: initialRepos } as Partial<AppState>)
})

describe('resolveBackendDraftStartup', () => {
  it.each([null, 'ssh-target-1', 'runtime-ssh-env-1'])(
    'opens supported hook-backed drafts in chat on connection %s',
    (connectionId) => {
      setRepoConnection(connectionId)
      expect(viewModeFor('claude')).toBe('chat')
      expect(viewModeFor('codex')).toBe('chat')
    }
  )

  it.each([null, 'ssh-target-1', 'runtime-ssh-env-1'])(
    'keeps retired providers in the terminal on connection %s',
    (connectionId) => {
      setRepoConnection(connectionId)
      expect(viewModeFor('omp')).toBe('terminal')
      expect(viewModeFor('grok')).toBe('terminal')
    }
  )
})
