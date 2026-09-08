import { describe, expect, it } from 'vitest'
import { AGENT_CATALOG } from '@/lib/agent-catalog'
import { supportsTerminalAgentQuickCommand } from '../../../../shared/terminal-quick-commands'
import { getTerminalQuickCommandAgentOptions } from './terminal-quick-command-agent-options'

describe('terminal quick command agent options', () => {
  it('offers exactly the retained prompt-command agents in product order', () => {
    const ids = getTerminalQuickCommandAgentOptions().map((entry) => entry.id)
    expect(ids).toEqual(['claude', 'codex'])
    expect(ids.every(supportsTerminalAgentQuickCommand)).toBe(true)
    expect(supportsTerminalAgentQuickCommand('openclaude')).toBe(false)
    expect(supportsTerminalAgentQuickCommand('command-code')).toBe(false)
  })

  it('keeps the same agent set as the global catalog', () => {
    expect(new Set(getTerminalQuickCommandAgentOptions().map((entry) => entry.id))).toEqual(
      new Set(AGENT_CATALOG.map((entry) => entry.id))
    )
  })
})
