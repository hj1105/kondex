import { beforeEach, describe, expect, it, vi } from 'vitest'

import type * as TuiAgentSelectionModule from '../../../shared/tui-agent-selection'
import type * as TuiAgentStartupModule from '@/lib/tui-agent-startup'

const mocks = vi.hoisted(() => ({
  toastError: vi.fn(),
  createWorktree: vi.fn(),
  ensureDetectedAgents: vi.fn(),
  ensureRemoteDetectedAgents: vi.fn(),
  updateWorktreeMeta: vi.fn(),
  setSidebarOpen: vi.fn(),
  seedNativeChatLaunchPrompt: vi.fn(),
  seedNativeChatLaunchDraft: vi.fn(),
  markNativeChatLaunchPromptFailed: vi.fn(),
  activateAndRevealWorktree: vi.fn(),
  pasteDraftWhenAgentReady: vi.fn(),
  openModalFallback: vi.fn(),
  resolvePrBase: vi.fn(),
  getConnectionId: vi.fn(),
  store: {} as Record<string, unknown> & {
    ensureDetectedAgents: ReturnType<typeof vi.fn>
    ensureRemoteDetectedAgents: ReturnType<typeof vi.fn>
    createWorktree: ReturnType<typeof vi.fn>
    updateWorktreeMeta: ReturnType<typeof vi.fn>
    setSidebarOpen: ReturnType<typeof vi.fn>
    seedNativeChatLaunchPrompt: ReturnType<typeof vi.fn>
    seedNativeChatLaunchDraft: ReturnType<typeof vi.fn>
    markNativeChatLaunchPromptFailed: ReturnType<typeof vi.fn>
  }
}))

vi.mock('@/store', () => ({
  useAppStore: {
    getState: () => mocks.store
  }
}))

vi.mock('sonner', () => ({
  toast: {
    error: mocks.toastError,
    message: vi.fn()
  }
}))

vi.mock('@/lib/agent-paste-draft', () => ({
  pasteDraftWhenAgentReady: mocks.pasteDraftWhenAgentReady
}))

vi.mock('@/lib/worktree-activation', () => ({
  activateAndRevealWorktree: mocks.activateAndRevealWorktree
}))

vi.mock('@/lib/ensure-hooks-confirmed', () => ({
  ensureHooksConfirmed: vi.fn().mockResolvedValue('run')
}))

vi.mock('@/lib/connection-context', () => ({
  getConnectionId: mocks.getConnectionId
}))

vi.mock('@/runtime/runtime-hooks-client', () => ({
  checkRuntimeHooks: vi
    .fn()
    .mockResolvedValue({ hasHooks: false, hooks: null, mayNeedUpdate: false })
}))

vi.mock('@/runtime/runtime-rpc-client', () => ({
  getActiveRuntimeTarget: vi.fn().mockReturnValue({ kind: 'local' }),
  callRuntimeRpc: vi.fn()
}))

vi.mock('@/lib/new-workspace', () => ({
  CLIENT_PLATFORM: 'win32',
  getWorkspaceIntentName: (args: {
    workItem?: { type: 'issue' | 'pr' | 'mr'; number: number; title: string } | null
  }) =>
    args.workItem
      ? {
          displayName:
            args.workItem.type === 'pr'
              ? `Review PR ${args.workItem.number}`
              : `Issue ${args.workItem.number}`,
          seedName:
            args.workItem.type === 'pr'
              ? `review-pr-${args.workItem.number}`
              : `issue-${args.workItem.number}`
        }
      : null,
  getSetupConfig: vi.fn(() => null),
  getWorkspaceSeedName: ({ explicitName }: { explicitName?: string }) => explicitName ?? '',
  isGitLabIssueUrl: vi.fn(() => false)
}))

vi.mock('@/lib/tui-agent-startup', async () => {
  const actual = await vi.importActual<typeof TuiAgentStartupModule>('@/lib/tui-agent-startup')
  return {
    ...actual,
    buildAgentDraftLaunchPlan: vi.fn(actual.buildAgentDraftLaunchPlan),
    buildAgentStartupPlan: vi.fn(actual.buildAgentStartupPlan)
  }
})

vi.mock('../../../shared/tui-agent-selection', async () => {
  const actual = await vi.importActual<typeof TuiAgentSelectionModule>(
    '../../../shared/tui-agent-selection'
  )
  return {
    ...actual,
    pickTuiAgent: vi.fn(actual.pickTuiAgent)
  }
})

import { buildAgentDraftLaunchPlan, buildAgentStartupPlan } from '@/lib/tui-agent-startup'

const mockApi = {
  worktrees: {
    resolvePrBase: mocks.resolvePrBase
  },
  agentTrust: {
    markTrusted: vi.fn()
  }
}

describe('launchWorkItemDirect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('window', {
      api: {
        worktrees: {
          resolvePrBase: mocks.resolvePrBase
        },
        agentTrust: {
          markTrusted: mockApi.agentTrust.markTrusted
        }
      }
    })
    mocks.resolvePrBase.mockResolvedValue({
      baseBranch: 'abc123',
      compareBaseRef: 'refs/remotes/origin/main',
      headSha: 'abc123',
      branchNameOverride: 'feature/fix',
      pushTarget: { remoteName: 'origin', branchName: 'feature/fix' }
    })
    mocks.ensureDetectedAgents.mockResolvedValue(['codex'])
    mocks.ensureRemoteDetectedAgents.mockResolvedValue(['codex'])
    mocks.getConnectionId.mockReturnValue(null)
    mocks.createWorktree.mockResolvedValue({
      worktree: { id: 'repo-1::/repo/worktree', path: '/repo/worktree' },
      setup: undefined
    })
    mocks.updateWorktreeMeta.mockResolvedValue(undefined)
    mocks.activateAndRevealWorktree.mockReturnValue({ primaryTabId: 'tab-1' })
    mocks.pasteDraftWhenAgentReady.mockResolvedValue(true)
    mocks.store = {
      repos: [
        {
          id: 'repo-1',
          path: '/repo',
          displayName: 'Repo',
          addedAt: 1
        }
      ],
      activeRepoId: 'repo-1',
      activeWorktreeId: null,
      projects: [
        {
          id: 'repo-1',
          displayName: 'Repo',
          badgeColor: '#000000',
          sourceRepoIds: ['repo-1'],
          createdAt: 1,
          updatedAt: 1
        }
      ],
      worktreesByRepo: {},
      settings: {
        defaultTuiAgent: 'codex',
        disabledTuiAgents: [],
        agentCmdOverrides: {}
      },
      ensureDetectedAgents: mocks.ensureDetectedAgents,
      ensureRemoteDetectedAgents: mocks.ensureRemoteDetectedAgents,
      createWorktree: mocks.createWorktree,
      updateWorktreeMeta: mocks.updateWorktreeMeta,
      setSidebarOpen: mocks.setSidebarOpen,
      seedNativeChatLaunchPrompt: mocks.seedNativeChatLaunchPrompt,
      seedNativeChatLaunchDraft: mocks.seedNativeChatLaunchDraft,
      markNativeChatLaunchPromptFailed: mocks.markNativeChatLaunchPromptFailed
    } as typeof mocks.store
    // @ts-expect-error -- test shim
    globalThis.window = { api: mockApi }
    mockApi.agentTrust.markTrusted.mockResolvedValue(undefined)
  })

  it('rejects invalid per-launch CLI arguments before creating a workspace', async () => {
    const { launchWorkItemDirect } = await import('./launch-work-item-direct')

    await expect(
      launchWorkItemDirect({
        repoId: 'repo-1',
        launchSource: 'task_page',
        openModalFallback: vi.fn(),
        agentArgs: '--model "unterminated',
        item: {
          type: 'issue',
          number: 42,
          title: 'Fix invalid saved launch args',
          url: 'https://github.com/acme/repo/issues/42'
        }
      })
    ).resolves.toBe(false)

    expect(mocks.createWorktree).not.toHaveBeenCalled()
    expect(mocks.ensureDetectedAgents).not.toHaveBeenCalled()
    expect(mocks.toastError).toHaveBeenCalledWith(
      'CLI arguments are invalid: Unclosed quote in command template.'
    )
  })

  it('passes a resolved PR branch override while using a short PR identity for workspace names', async () => {
    mocks.ensureDetectedAgents.mockResolvedValue([])
    mocks.store.settings = {}
    const { launchWorkItemDirect } = await import('./launch-work-item-direct')

    await launchWorkItemDirect({
      repoId: 'repo-1',
      launchSource: 'task_page',
      telemetrySource: 'sidebar',
      openModalFallback: vi.fn(),
      item: {
        type: 'pr',
        number: 6934,
        title: 'Fix the bug',
        url: 'https://github.com/stablyai/orca/pull/6934',
        branchName: 'feature/fix',
        baseRefName: 'main',
        isCrossRepository: true
      }
    })

    expect(mocks.resolvePrBase).toHaveBeenCalledWith({
      repoId: 'repo-1',
      prNumber: 6934,
      headRefName: 'feature/fix',
      baseRefName: 'main',
      isCrossRepository: true
    })
    expect(mocks.createWorktree).toHaveBeenCalledWith(
      'repo-1',
      'review-pr-6934',
      'abc123',
      'inherit',
      undefined,
      'sidebar',
      'Review PR 6934',
      undefined,
      6934,
      { remoteName: 'origin', branchName: 'feature/fix' },
      undefined,
      'feature/fix',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'refs/remotes/origin/main'
    )
  })

  it('treats a PR-typed GitHub issue URL as an issue without resolving a PR head', async () => {
    const { launchWorkItemDirect } = await import('./launch-work-item-direct')
    const openModalFallback = vi.fn()

    await expect(
      launchWorkItemDirect({
        repoId: 'repo-1',
        launchSource: 'task_page',
        telemetrySource: 'sidebar',
        openModalFallback,
        item: {
          type: 'pr',
          number: 6933,
          title: 'The board columns are displayed backwards',
          url: 'https://github.com/stablyai/orca/issues/6933',
          branchName: 'fix-issue-6933',
          baseRefName: 'main',
          isCrossRepository: true
        }
      })
    ).resolves.toBe(true)

    expect(mocks.resolvePrBase).not.toHaveBeenCalled()
    expect(openModalFallback).not.toHaveBeenCalled()
    const createArgs = mocks.createWorktree.mock.calls[0]
    expect(createArgs?.[1]).toBe('issue-6933')
    expect(createArgs?.[2]).toBeUndefined()
    expect(createArgs?.[6]).toBe('Issue 6933')
    expect(createArgs?.[7]).toBe(6933)
    expect(createArgs?.[8]).toBeUndefined()
    expect(createArgs?.[9]).toBeUndefined()
    expect(createArgs?.[12]).toBeUndefined()
    expect(createArgs?.[24]).toBeUndefined()
  })

  it('seeds the chat-composer launch draft for a GitHub issue draft launch', async () => {
    mocks.ensureDetectedAgents.mockResolvedValue(['claude'])
    const { launchWorkItemDirect } = await import('./launch-work-item-direct')

    await expect(
      launchWorkItemDirect({
        repoId: 'repo-1',
        launchSource: 'task_page',
        openModalFallback: vi.fn(),
        agentOverride: 'claude',
        item: {
          type: 'issue',
          number: 12,
          title: 'Fix crash on launch',
          url: 'https://github.com/acme/repo/issues/12'
        }
      })
    ).resolves.toBe(true)

    // The issue link prefills only the TUI input (argv `--prefill`); the seeded
    // draft is what makes the same context visible in the chat view.
    expect(mocks.seedNativeChatLaunchDraft).toHaveBeenCalledWith({
      tabId: 'tab-1',
      agent: 'claude',
      text: 'https://github.com/acme/repo/issues/12',
      createdAt: expect.any(Number)
    })
    expect(mocks.seedNativeChatLaunchPrompt).not.toHaveBeenCalled()
    // Why: the draft is inside `--prefill`, so the plan sets no draftPrompt.
    // launchDraftText is the only thing that lets the view-mode gate see a
    // draft here — without it this tab opens in chat unconditionally.
    const startup = mocks.activateAndRevealWorktree.mock.calls.at(-1)?.[1]?.startup
    expect(startup?.draftPrompt).toBeUndefined()
    expect(startup?.launchDraftText).toBe('https://github.com/acme/repo/issues/12')
  })

  it('does not launch a disabled saved agent even when another agent is available', async () => {
    mocks.ensureDetectedAgents.mockResolvedValue(['codex', 'claude'])
    mocks.store.settings = {
      defaultTuiAgent: 'claude',
      disabledTuiAgents: ['codex'],
      agentCmdOverrides: {}
    }
    const { launchWorkItemDirect } = await import('./launch-work-item-direct')

    await expect(
      launchWorkItemDirect({
        item: {
          title: 'Fix failing checks',
          url: 'https://github.com/acme/repo/pull/1',
          type: 'issue',
          number: 1,
          pasteContent: 'Fix the failing checks.'
        },
        repoId: 'repo-1',
        openModalFallback: mocks.openModalFallback,
        launchSource: 'task_page',
        agentOverride: 'codex',
        promptDelivery: 'submit-after-ready'
      })
    ).resolves.toBe(false)

    expect(mocks.createWorktree).toHaveBeenCalled()
    expect(mocks.updateWorktreeMeta).not.toHaveBeenCalled()
    expect(mocks.pasteDraftWhenAgentReady).not.toHaveBeenCalled()
    expect(mocks.toastError).toHaveBeenCalledWith(
      'Selected agent is not available in the created workspace.'
    )
  })

  it('plans direct SSH workspace agent startup for the remote host platform', async () => {
    mocks.getConnectionId.mockReturnValue('ssh-1')
    mocks.ensureRemoteDetectedAgents.mockResolvedValue(['claude'])
    mocks.store.repos = [
      {
        id: 'repo-1',
        path: '/home/alice/repo',
        connectionId: 'ssh-1',
        displayName: 'Remote Repo',
        addedAt: 1
      }
    ]
    const { launchWorkItemDirect } = await import('./launch-work-item-direct')

    await expect(
      launchWorkItemDirect({
        item: {
          title: 'Fix failing checks',
          url: 'https://github.com/acme/repo/pull/1',
          type: 'issue',
          number: 1,
          pasteContent: 'Fix the failing checks.'
        },
        repoId: 'repo-1',
        openModalFallback: mocks.openModalFallback,
        launchSource: 'task_page',
        agentOverride: 'claude'
      })
    ).resolves.toBe(true)

    expect(mocks.activateAndRevealWorktree).toHaveBeenCalled()
    const activationOptions = mocks.activateAndRevealWorktree.mock.calls.at(-1)?.[1]
    expect(activationOptions.startup.command).toContain('claude')
    expect(buildAgentDraftLaunchPlan).toHaveBeenCalledWith(
      expect.objectContaining({ platform: 'linux', isRemote: true })
    )
  })

  it('uses the repo SSH connection when the created worktree is not hydrated yet', async () => {
    mocks.getConnectionId.mockReturnValue(undefined)
    mocks.ensureRemoteDetectedAgents.mockResolvedValue(['claude'])
    mocks.store.settings = {
      defaultTuiAgent: 'claude',
      disabledTuiAgents: [],
      agentCmdOverrides: {}
    }
    mocks.store.repos = [
      {
        id: 'repo-1',
        path: '/home/alice/repo',
        connectionId: 'ssh-1',
        displayName: 'Remote Repo',
        addedAt: 1
      }
    ]
    const { launchWorkItemDirect } = await import('./launch-work-item-direct')

    await expect(
      launchWorkItemDirect({
        item: {
          title: 'Fix failing checks',
          url: 'https://github.com/acme/repo/pull/1',
          type: 'issue',
          number: 1,
          pasteContent: 'Fix the failing checks.'
        },
        repoId: 'repo-1',
        openModalFallback: mocks.openModalFallback,
        launchSource: 'task_page'
      })
    ).resolves.toBe(true)

    expect(mocks.ensureRemoteDetectedAgents).toHaveBeenCalledWith('ssh-1')
    expect(mocks.ensureDetectedAgents).not.toHaveBeenCalled()
    const activationOptions = mocks.activateAndRevealWorktree.mock.calls.at(-1)?.[1]
    expect(activationOptions.startup.command).toContain('claude')
    expect(buildAgentDraftLaunchPlan).toHaveBeenCalledWith(
      expect.objectContaining({ platform: 'linux', isRemote: true })
    )
  })

  it('plans direct local Windows-path launches with POSIX startup for WSL project runtime', async () => {
    mocks.store.repos = [
      {
        id: 'repo-1',
        path: 'C:\\Users\\alice\\repo',
        displayName: 'Repo',
        addedAt: 1
      }
    ]
    mocks.store.projects = [
      {
        id: 'repo-1',
        displayName: 'Repo',
        badgeColor: '#000000',
        sourceRepoIds: ['repo-1'],
        createdAt: 1,
        updatedAt: 1,
        localWindowsRuntimePreference: { kind: 'wsl', distro: 'Ubuntu' }
      }
    ]
    mocks.store.createWorktree.mockResolvedValue({
      worktree: {
        id: 'repo-1::C:\\Users\\alice\\repo-worktree',
        path: 'C:\\Users\\alice\\repo-worktree'
      }
    })
    const { launchWorkItemDirect } = await import('./launch-work-item-direct')

    await expect(
      launchWorkItemDirect({
        item: {
          title: 'Fix failing checks',
          url: 'https://github.com/acme/repo/pull/1',
          type: 'issue',
          number: 1,
          pasteContent: 'Fix the failing checks.'
        },
        repoId: 'repo-1',
        openModalFallback: mocks.openModalFallback,
        launchSource: 'task_page',
        agentOverride: 'codex',
        promptDelivery: 'submit-after-ready'
      })
    ).resolves.toBe(true)

    expect(buildAgentStartupPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: 'codex',
        platform: 'linux'
      })
    )
  })
})
