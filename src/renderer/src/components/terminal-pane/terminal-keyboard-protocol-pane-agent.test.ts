import { describe, expect, it } from 'vitest'

import { resolvePaneKeyboardProtocolAgent } from './terminal-keyboard-protocol-pane-agent'

describe('pane-scoped terminal keyboard protocol agent', () => {
  it('keeps explicit pane startup identity ahead of a stale tab launch agent', () => {
    expect(resolvePaneKeyboardProtocolAgent({ launchAgent: 'claude' }, 'codex')).toBe('claude')
  })
  it('uses tab identity only when no pane startup payload exists', () => {
    expect(resolvePaneKeyboardProtocolAgent(undefined, 'codex')).toBe('codex')
    expect(resolvePaneKeyboardProtocolAgent({}, 'codex')).toBeNull()
    expect(resolvePaneKeyboardProtocolAgent(null, 'codex')).toBeNull()
  })
})
