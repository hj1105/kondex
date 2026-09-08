// A worker parked on an interactive prompt must be distinguishable from one that is thinking
// or inside a long tool call (STA-4513, STA-3714).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { OrcaRuntimeService } from './orca-runtime'
import { assertTerminalAgentSendable } from './rpc/terminal-agent-send-guard'

vi.mock('electron', () => ({
  BrowserWindow: { fromId: vi.fn(() => null) },
  webContents: { fromId: vi.fn(() => null) },
  ipcMain: { on: vi.fn(), removeListener: vi.fn() },
  app: { getPath: vi.fn(() => '/tmp') }
}))

const LEAF_ID = '11111111-1111-4111-8111-111111111111'
const TAB_ID = 'tab-1'
const WORKTREE_ID = 'wt-1'
const PTY_ID = 'pty-1'

// Captured verbatim from cursor-agent 2026.08.11-e8db854 driven through Orca.
function fixture(name: string): string {
  return readFileSync(join(__dirname, '__fixtures__', `${name}.txt`), 'utf8')
}
const CURSOR_APPROVAL = fixture('cursor-agent-approval-prompt')
const CURSOR_LONG_TOOL_CALL = fixture('cursor-agent-long-tool-call')
const CURSOR_IDLE = fixture('cursor-agent-idle-after-approval')

// Claude Code 2.1.234's own trust screen, which the runtime already matched by shape.
const CLAUDE_TRUST = [
  'Accessing workspace:\n',
  '/private/tmp/repo\n',
  'Quick safety check: Is this a project you created or one you trust?\n',
  '❯ 1. Yes, I trust this folder\n',
  '  2. No, exit\n'
].join('')

function agentStatusOsc(state: string): string {
  return `]9999;${JSON.stringify({ state, prompt: 'ship it', agentType: 'claude' })}`
}

async function createPane(options: {
  paneTitle: string
  foregroundProcess: string | null
  data: string
  /** Set for a pane whose PTY lives on an SSH host or WSL distro rather than locally. */
  connectionId?: string
  /** Simulates a PTY controller whose foreground probe never settles. */
  foregroundProbeHangs?: boolean
  onForegroundProbe?: () => void
}): Promise<{ runtime: OrcaRuntimeService; handle: string }> {
  const runtime = new OrcaRuntimeService(null)
  const internals = runtime as unknown as {
    resolveTerminalWorkspaceLaunchScope: (selector: string) => Promise<unknown>
  }
  vi.spyOn(internals, 'resolveTerminalWorkspaceLaunchScope').mockResolvedValue({
    id: WORKTREE_ID,
    path: '/repo/app',
    connectionId: options.connectionId ?? null,
    repo: null,
    folderWorkspace: null
  })
  runtime.setPtyController({
    spawn: vi.fn().mockResolvedValue({ id: PTY_ID, incarnationId: 'inc-1' }),
    write: () => true,
    kill: () => true,
    getForegroundProcess: (): Promise<string | null> => {
      options.onForegroundProbe?.()
      return options.foregroundProbeHangs === true
        ? new Promise<string | null>(() => {})
        : Promise.resolve(options.foregroundProcess)
    }
  })
  const terminal = await runtime.createTerminal(`id:${WORKTREE_ID}`, {
    tabId: TAB_ID,
    leafId: LEAF_ID,
    title: 'Terminal'
  })
  runtime.attachWindow(1)
  runtime.syncWindowGraph(1, {
    tabs: [
      {
        tabId: TAB_ID,
        worktreeId: WORKTREE_ID,
        title: 'Terminal',
        activeLeafId: LEAF_ID,
        layout: null
      }
    ],
    leaves: [
      {
        tabId: TAB_ID,
        worktreeId: WORKTREE_ID,
        leafId: LEAF_ID,
        paneRuntimeId: 1,
        ptyId: PTY_ID,
        paneTitle: options.paneTitle
      }
    ]
  })
  // Why the guard: a restore seed is only applied to a never-written record, so the restore
  // cases must not write an empty chunk first.
  if (options.data.length > 0) {
    runtime.onPtyData(PTY_ID, options.data, Date.now())
  }
  return { runtime, handle: terminal.handle }
}

// A historical spinner is generic activity, not evidence of a supported provider.
const CURSOR_TITLE = '⠇ Cursor Agent'

describe('terminal interactive-wait visibility (STA-4513, STA-3714)', () => {
  describe('retained-provider prompts and send guards', () => {
    it('names a Claude trust prompt on the pane a coordinator inspects', async () => {
      const { runtime, handle } = await createPane({
        paneTitle: 'worker',
        foregroundProcess: 'claude',
        data: CLAUDE_TRUST
      })

      await expect(runtime.showTerminal(handle)).resolves.toMatchObject({
        agentWait: { source: 'prompt-text', reason: 'codex-trust-workspace' }
      })
      await expect(runtime.getTerminalInteractiveWait(handle)).resolves.toMatchObject({
        source: 'prompt-text',
        reason: 'codex-trust-workspace',
        since: expect.any(Number)
      })
    })

    it('refuses a guarded send and dispatch preamble while trust is unanswered', async () => {
      const { runtime, handle } = await createPane({
        paneTitle: 'worker',
        foregroundProcess: 'claude',
        data: CLAUDE_TRUST
      })

      await expect(runtime.getTerminalAgentStatus(handle)).resolves.toMatchObject({
        isRunningAgent: true,
        status: 'permission'
      })
      await expect(
        assertTerminalAgentSendable({
          runtime,
          handle,
          assertWritable: () => {}
        })
      ).rejects.toThrow('terminal_guard_permission')
      await expect(runtime.sendTerminalAgentPrompt(handle, 'coordinator preamble')).rejects.toThrow(
        'agent_prompt_blocked'
      )
    })

    it('releases the send guard when a live working title dismisses the trust screen', async () => {
      const { runtime, handle } = await createPane({
        paneTitle: 'worker',
        foregroundProcess: 'claude',
        data: CLAUDE_TRUST
      })
      await expect(runtime.getTerminalInteractiveWait(handle)).resolves.not.toBeNull()

      runtime.onPtyData(PTY_ID, '\x1b]0;✻ Claude Code\x07', Date.now())

      await expect(runtime.getTerminalInteractiveWait(handle)).resolves.toBeNull()
      await expect(
        assertTerminalAgentSendable({
          runtime,
          handle,
          assertWritable: () => {}
        })
      ).resolves.toBeUndefined()
    })

    it('refuses to call the lane idle while trust is unanswered', async () => {
      const { runtime, handle } = await createPane({
        paneTitle: 'worker',
        foregroundProcess: 'claude',
        data: CLAUDE_TRUST
      })

      await expect(
        runtime.waitForTerminal(handle, { condition: 'tui-idle', timeoutMs: 400 })
      ).resolves.toMatchObject({ satisfied: false, blockedReason: 'codex-trust-workspace' })
    })

    it('reports explicit no-wait while a retained agent is working', async () => {
      const { runtime, handle } = await createPane({
        paneTitle: '✻ Claude Code',
        foregroundProcess: 'claude',
        data: agentStatusOsc('working')
      })

      await expect(runtime.getTerminalAgentStatus(handle)).resolves.toMatchObject({
        isRunningAgent: true,
        status: 'working'
      })
      await expect(runtime.getTerminalInteractiveWait(handle)).resolves.toBeNull()
      await expect(runtime.showTerminal(handle)).resolves.toMatchObject({ agentWait: null })
    })

    it('reports no wait for an explicitly idle retained agent', async () => {
      const { runtime, handle } = await createPane({
        paneTitle: '✳ Claude Code',
        foregroundProcess: 'claude',
        data: 'Ready.\n'
      })

      await expect(runtime.getTerminalAgentStatus(handle)).resolves.toMatchObject({
        isRunningAgent: true,
        status: 'idle'
      })
      await expect(runtime.getTerminalInteractiveWait(handle)).resolves.toBeNull()
    })

    it('reports the same trust wait for a remote-owned PTY', async () => {
      const { runtime, handle } = await createPane({
        paneTitle: 'worker',
        foregroundProcess: 'claude',
        data: CLAUDE_TRUST,
        connectionId: 'ssh:build-host'
      })

      await expect(runtime.getTerminalInteractiveWait(handle)).resolves.toMatchObject({
        source: 'prompt-text',
        reason: 'codex-trust-workspace'
      })
    })
  })

  it.each([
    ['approval', CURSOR_APPROVAL],
    ['tool call', CURSOR_LONG_TOOL_CALL],
    ['idle', CURSOR_IDLE],
    ['answered menu', `${CURSOR_APPROVAL}\n${CURSOR_IDLE}`],
    ['later output', `${CURSOR_APPROVAL}\nCommand completed successfully.\n`],
    ['choice narration', `${CURSOR_APPROVAL}\nNext time I will suggest Run Everything.\n`],
    ['unanswered-looking prose', 'You can pick Run Everything or Run (once) if you prefer.\n'],
    ['menu footer', `${CURSOR_APPROVAL}\n  Auto · 6.1%\n`],
    ['partial menu', 'The agent asked: Run this command? I said yes and it worked.\n']
  ])('does not infer a supported wait from historical Cursor %s', async (_name, data) => {
    const { runtime, handle } = await createPane({
      paneTitle: CURSOR_TITLE,
      foregroundProcess: 'cursor-agent',
      data
    })

    await expect(runtime.getTerminalAgentStatus(handle)).resolves.toMatchObject({
      status: 'working'
    })
    await expect(runtime.getTerminalInteractiveWait(handle)).resolves.toBeNull()
  })

  describe('prompts the runtime already matched but never surfaced', () => {
    it('surfaces a startup trust screen on the pane, not only on terminal wait', async () => {
      // A pane on its trust screen still wears Orca's tab title; the agent has set none.
      const { runtime, handle } = await createPane({
        paneTitle: 'sta4513-claude',
        foregroundProcess: 'claude',
        data: CLAUDE_TRUST
      })

      await expect(runtime.showTerminal(handle)).resolves.toMatchObject({
        agentWait: { source: 'prompt-text', reason: 'codex-trust-workspace' }
      })
    })

    it('still lets a live working title clear a stale startup prompt', async () => {
      // Pins the shared authority getTerminalAgentStatus and the agent-prompt send guard
      // already use: for the startup modals, a live non-permission title is the staleness
      // proof, because their text survives in scrollback with no self-dismissal marker.
      const { runtime, handle } = await createPane({
        paneTitle: '✻ Claude Code',
        foregroundProcess: 'claude',
        data: CLAUDE_TRUST
      })

      await expect(runtime.getTerminalInteractiveWait(handle)).resolves.toBeNull()
    })
  })

  describe('hook-reported waits (STA-3714)', () => {
    it('surfaces an agent-reported blocked state with hook provenance', async () => {
      const { runtime, handle } = await createPane({
        paneTitle: '✻ Claude Code',
        foregroundProcess: 'claude',
        data: agentStatusOsc('waiting')
      })

      await expect(runtime.getTerminalInteractiveWait(handle)).resolves.toMatchObject({
        source: 'hook',
        since: expect.any(Number)
      })
      await expect(runtime.showTerminal(handle)).resolves.toMatchObject({
        agentWait: { source: 'hook' }
      })
    })

    it('reports no wait for a hook-reported working turn', async () => {
      const { runtime, handle } = await createPane({
        paneTitle: '✻ Claude Code',
        foregroundProcess: 'claude',
        data: agentStatusOsc('working')
      })

      await expect(runtime.getTerminalInteractiveWait(handle)).resolves.toBeNull()
    })

    it('drops a retained permission row once the agent stops owning the pane', async () => {
      // Why not the title alone: a shell that takes the pane back usually sets something like
      // `user@host: ~/repo`, which no title rule recognizes, and a hook row stays fresh for
      // AGENT_STATUS_STALE_AFTER_MS — half an hour of reporting a dead agent as waiting.
      const { runtime, handle } = await createPane({
        paneTitle: 'jinwoo@host: ~/repo',
        foregroundProcess: 'zsh',
        data: agentStatusOsc('waiting')
      })

      await expect(runtime.getTerminalInteractiveWait(handle)).resolves.toBeNull()
    })

    it('drops a retained permission row once a shell owns the pane', async () => {
      const { runtime, handle } = await createPane({
        paneTitle: 'zsh',
        foregroundProcess: 'zsh',
        data: agentStatusOsc('blocked')
      })

      await expect(runtime.getTerminalInteractiveWait(handle)).resolves.toBeNull()
    })
  })

  it('does not resurrect a retired provider wait from terminal history', async () => {
    const { runtime, handle } = await createPane({
      paneTitle: CURSOR_TITLE,
      foregroundProcess: 'cursor-agent',
      data: ''
    })
    runtime.seedTerminalRestoreTail(PTY_ID, { text: CURSOR_APPROVAL, lastTitle: CURSOR_TITLE })

    await expect(runtime.getTerminalInteractiveWait(handle)).resolves.toBeNull()
  })

  it('does not resurrect a startup modal from a restored tail', async () => {
    // The startup prompts keep the timestamp rule: their text lingers in scrollback with no
    // marker for whether it was answered, so restored bytes alone must not mint a wait.
    const { runtime, handle } = await createPane({
      paneTitle: 'sta4513-claude',
      foregroundProcess: 'claude',
      data: ''
    })
    runtime.seedTerminalRestoreTail(PTY_ID, { text: CLAUDE_TRUST })

    await expect(runtime.getTerminalInteractiveWait(handle)).resolves.toBeNull()
  })

  it('stops reporting a wait once the pane is no longer running', async () => {
    // Why: the menu stays at the bottom of a dead pane's tail forever. A worker whose process
    // is gone needs intervention, not an answer, so it must not read as blocked on a human.
    const { runtime, handle } = await createPane({
      paneTitle: 'worker',
      foregroundProcess: 'claude',
      data: CLAUDE_TRUST
    })
    await expect(runtime.getTerminalInteractiveWait(handle)).resolves.not.toBeNull()

    runtime.onPtyExit(PTY_ID, 0)

    await expect(runtime.getTerminalInteractiveWait(handle)).resolves.toBeUndefined()
  })

  it('does not accrue a probe per poll while the foreground probe wedges', async () => {
    // Why: the timeout abandons the wait, not the request. Without single-flighting, a
    // coordinator watching a wedged remote host adds one live probe on every poll.
    let probes = 0
    const { runtime, handle } = await createPane({
      paneTitle: '✻ Claude Code',
      foregroundProcess: 'claude',
      data: agentStatusOsc('waiting'),
      onForegroundProbe: () => {
        probes += 1
      },
      foregroundProbeHangs: true
    })

    await Promise.all([
      runtime.getTerminalInteractiveWait(handle),
      runtime.getTerminalInteractiveWait(handle),
      runtime.getTerminalInteractiveWait(handle)
    ])

    expect(probes).toBe(1)
  }, 20_000)

  it('does not infer a wait from a retired menu with glyph decision keys', async () => {
    const { runtime, handle } = await createPane({
      paneTitle: CURSOR_TITLE,
      foregroundProcess: 'cursor-agent',
      data: [
        'Run this command?\n',
        '  → Run (once) (\u21b5)\n',
        '    Run Everything (\u21e7\u21b9)\n'
      ].join('')
    })

    await expect(runtime.getTerminalInteractiveWait(handle)).resolves.toBeNull()
  })

  it('still rejects prose that merely ends in parentheses', async () => {
    const { runtime, handle } = await createPane({
      paneTitle: CURSOR_TITLE,
      foregroundProcess: 'cursor-agent',
      data: `${CURSOR_APPROVAL}\nNext time I will suggest Run Everything (as before)\n`
    })

    await expect(runtime.getTerminalInteractiveWait(handle)).resolves.toBeNull()
  })

  it('leaves the wait unevaluated when the foreground probe wedges', async () => {
    // Why bounded: this probe reaches a PTY controller that can be a remote host. A wedged
    // one must leave the wait unknown, not stall every caller of showTerminal.
    const { runtime, handle } = await createPane({
      paneTitle: '✻ Claude Code',
      foregroundProcess: 'claude',
      data: agentStatusOsc('waiting'),
      foregroundProbeHangs: true
    })

    await expect(runtime.getTerminalInteractiveWait(handle)).resolves.toBeUndefined()
    const show = (await runtime.showTerminal(handle)) as Record<string, unknown>
    expect('agentWait' in show).toBe(false)
  }, 15_000)

  it('answers undefined rather than "not waiting" for a pane it cannot read', async () => {
    const { runtime } = await createPane({
      paneTitle: 'worker',
      foregroundProcess: 'claude',
      data: CLAUDE_TRUST
    })

    await expect(runtime.getTerminalInteractiveWait('term_does_not_exist')).resolves.toBeUndefined()
  })
})
