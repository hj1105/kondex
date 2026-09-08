import { describe, expect, it, vi } from 'vitest'
import { hasCtrlEnterCsiUAuthorityForPane } from './terminal-ctrl-enter'
import type * as TuiAgentConfig from '../../../../shared/tui-agent-config'

// Exercise the capability boundary without enabling CSI-u in the shipped catalog.
vi.mock('../../../../shared/tui-agent-config', async (importOriginal) => {
  const actual = await importOriginal<typeof TuiAgentConfig>()
  return {
    ...actual,
    TUI_AGENT_CONFIG: {
      ...actual.TUI_AGENT_CONFIG,
      claude: { ...actual.TUI_AGENT_CONFIG.claude, ctrlEnterEncoding: 'csi-u' }
    }
  }
})

const PANE_KEY = 'tab:pane'

describe('hasCtrlEnterCsiUAuthorityForPane', () => {
  it('authorizes only trusted Ctrl+Enter CSI-u consumers', () => {
    for (const agent of ['claude'] as const) {
      expect(
        hasCtrlEnterCsiUAuthorityForPane(
          {
            paneForegroundAgentByPaneKey: {
              [PANE_KEY]: { agent, routingTrusted: true, shellForeground: false }
            }
          },
          PANE_KEY
        )
      ).toBe(true)
    }
    expect(
      hasCtrlEnterCsiUAuthorityForPane(
        {
          paneForegroundAgentByPaneKey: {
            [PANE_KEY]: { agent: 'codex', routingTrusted: true, shellForeground: false }
          }
        },
        PANE_KEY
      )
    ).toBe(false)
  })

  it('uses strict titles only through unrevoked trust gaps', () => {
    const state = {
      paneForegroundAgentByPaneKey: {
        [PANE_KEY]: { agent: 'claude' as const, shellForeground: false }
      }
    }
    expect(hasCtrlEnterCsiUAuthorityForPane(state, PANE_KEY, '⠋ Claude Code')).toBe(true)
    expect(hasCtrlEnterCsiUAuthorityForPane(state, PANE_KEY, 'C:\\work\\grok-project')).toBe(false)
    expect(
      hasCtrlEnterCsiUAuthorityForPane(
        {
          paneForegroundAgentByPaneKey: {
            [PANE_KEY]: { agent: 'codex', shellForeground: false }
          }
        },
        PANE_KEY,
        'Claude Code'
      )
    ).toBe(false)

    for (const foreground of [
      { agent: 'claude' as const, routingRevoked: true, shellForeground: false },
      { agent: null, shellForeground: true },
      { agent: 'claude' as const, routingTrusted: true, shellForeground: true }
    ]) {
      expect(
        hasCtrlEnterCsiUAuthorityForPane(
          { paneForegroundAgentByPaneKey: { [PANE_KEY]: foreground } },
          PANE_KEY,
          'Claude Code'
        )
      ).toBe(false)
    }
  })
})
