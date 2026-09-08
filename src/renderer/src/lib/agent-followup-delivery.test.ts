import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sendFollowupPromptWhenAgentReady } from './agent-followup-delivery'
import {
  inspectRuntimeTerminalProcess,
  sendRuntimePtyInputVerified
} from '@/runtime/runtime-terminal-inspection'
import { TUI_AGENT_CONFIG } from '../../../shared/tui-agent-config'

vi.mock('@/runtime/runtime-terminal-inspection', () => ({
  inspectRuntimeTerminalProcess: vi.fn(),
  sendRuntimePtyInputVerified: vi.fn()
}))

// A retained agent can be launched behind a Node wrapper. Readiness must still
// distinguish that wrapper with live children from a bare shell.
const INTERPRETER_WRAPPED_AGENTS = [
  { agent: 'claude', expectedProcess: TUI_AGENT_CONFIG.claude.expectedProcess },
  { agent: 'codex', expectedProcess: TUI_AGENT_CONFIG.codex.expectedProcess }
] as const

describe('sendFollowupPromptWhenAgentReady — interpreter-wrapped agents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('globalThis', globalThis)
    // Deliver the prompt write eagerly so the test does not depend on retries.
    vi.mocked(sendRuntimePtyInputVerified).mockResolvedValue(true)
  })

  for (const { agent, expectedProcess } of INTERPRETER_WRAPPED_AGENTS) {
    it(`types the prompt once ${agent} is up behind a node wrapper with a live child`, async () => {
      // The wrapped agent is running: foreground comm is node and the
      // PTY has a non-shell child. The exact agent name never appears.
      vi.mocked(inspectRuntimeTerminalProcess).mockResolvedValue({
        foregroundProcess: 'node',
        hasChildProcesses: true
      })

      const delivered = await sendFollowupPromptWhenAgentReady({
        ptyId: 'pty-1',
        expectedProcess,
        prompt: 'ship it',
        settings: null
      })

      expect(delivered).toBe(true)
      expect(sendRuntimePtyInputVerified).toHaveBeenCalledWith(null, 'pty-1', 'ship it\r')
    })

    it(`still refuses to type into a bare ${agent} shell foreground`, async () => {
      // No agent yet: foreground is a plain shell with no non-shell child. The
      // guard must NOT write user text into an arbitrary shell.
      vi.mocked(inspectRuntimeTerminalProcess).mockResolvedValue({
        foregroundProcess: 'zsh',
        hasChildProcesses: false
      })

      const delivered = await sendFollowupPromptWhenAgentReady({
        ptyId: 'pty-1',
        expectedProcess,
        prompt: 'ship it',
        settings: null
      })

      expect(delivered).toBe(false)
      expect(sendRuntimePtyInputVerified).not.toHaveBeenCalled()
    })

    it(`refuses to type into a ${agent} wrapper without a live child`, async () => {
      vi.mocked(inspectRuntimeTerminalProcess).mockResolvedValue({
        foregroundProcess: 'node',
        hasChildProcesses: false
      })

      const delivered = await sendFollowupPromptWhenAgentReady({
        ptyId: 'pty-1',
        expectedProcess,
        prompt: 'ship it',
        settings: null
      })

      expect(delivered).toBe(false)
      expect(sendRuntimePtyInputVerified).not.toHaveBeenCalled()
    })
  }

  it('types immediately when the resolver already returns the agent name (local ps path)', async () => {
    // On local desktop the ps-table resolver usually resolves node → claude
    // before we poll; the exact-match path must keep working.
    vi.mocked(inspectRuntimeTerminalProcess).mockResolvedValue({
      foregroundProcess: 'claude',
      hasChildProcesses: true
    })

    const delivered = await sendFollowupPromptWhenAgentReady({
      ptyId: 'pty-1',
      expectedProcess: 'claude',
      prompt: 'ship it',
      settings: null
    })

    expect(delivered).toBe(true)
    expect(sendRuntimePtyInputVerified).toHaveBeenCalledWith(null, 'pty-1', 'ship it\r')
  })
})
