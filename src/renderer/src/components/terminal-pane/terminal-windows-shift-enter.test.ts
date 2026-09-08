import { describe, expect, it, vi } from 'vitest'
import {
  resolveWindowsShiftEnterEncoding,
  resolveWindowsShiftEnterEncodingForPane
} from './terminal-windows-shift-enter'
import type * as TuiAgentConfig from '../../../../shared/tui-agent-config'

// Exercise opt-in CSI-u routing without enabling it in the shipped provider catalog.
vi.mock('../../../../shared/tui-agent-config', async (importOriginal) => {
  const actual = await importOriginal<typeof TuiAgentConfig>()
  return {
    ...actual,
    TUI_AGENT_CONFIG: {
      ...actual.TUI_AGENT_CONFIG,
      claude: { ...actual.TUI_AGENT_CONFIG.claude, windowsShiftEnterEncoding: 'csi-u' }
    }
  }
})

describe('resolveWindowsShiftEnterEncoding', () => {
  it('keeps trusted process and shell evidence authoritative over titles', () => {
    const state = {
      paneForegroundAgentByPaneKey: {
        'tab:pane': {
          agent: 'codex' as const,
          routingTrusted: true,
          shellForeground: false
        }
      },
      agentLaunchConfigByPaneKey: {}
    }

    expect(resolveWindowsShiftEnterEncodingForPane(state, 'tab:pane', 'Claude ready')).toBe(
      'alt-enter'
    )
    expect(
      resolveWindowsShiftEnterEncodingForPane(
        {
          paneForegroundAgentByPaneKey: {
            'tab:pane': { agent: null, shellForeground: true }
          },
          agentLaunchConfigByPaneKey: {}
        },
        'tab:pane',
        'Claude ready'
      )
    ).toBe('alt-enter')
  })

  it('does not let a stale title undo explicit routing revocation', () => {
    const state = {
      paneForegroundAgentByPaneKey: {
        'tab:pane': {
          agent: 'claude' as const,
          routingRevoked: true,
          shellForeground: false
        }
      },
      agentLaunchConfigByPaneKey: {}
    }

    expect(resolveWindowsShiftEnterEncodingForPane(state, 'tab:pane', 'Claude ready')).toBe(
      'alt-enter'
    )
  })

  it('keeps the last CSI-u capability while revocation confirmation is pending', () => {
    expect(
      resolveWindowsShiftEnterEncoding({
        foreground: {
          agent: 'claude',
          routingRevoked: true,
          routingConfirmationPending: true,
          shellForeground: false
        }
      })
    ).toBe('csi-u')
  })

  it('keeps legacy bytes for plain shell and unsupported-agent titles', () => {
    const state = {
      paneForegroundAgentByPaneKey: {},
      agentLaunchConfigByPaneKey: {}
    }

    expect(resolveWindowsShiftEnterEncodingForPane(state, 'tab:pane', 'C:\\work\\pi-project')).toBe(
      'alt-enter'
    )
    expect(resolveWindowsShiftEnterEncodingForPane(state, 'tab:pane', 'Codex')).toBe('alt-enter')
  })

  it('does not let hook status route bytes without a pane title or process proof', () => {
    const state = {
      paneForegroundAgentByPaneKey: {},
      agentStatusByPaneKey: {
        'tab:pane': { agentType: 'claude' as const }
      },
      agentLaunchConfigByPaneKey: {}
    }

    expect(resolveWindowsShiftEnterEncodingForPane(state, 'tab:pane')).toBe('alt-enter')
  })

  it('keeps the legacy byte for untrusted agent and plain panes', () => {
    for (const agent of ['codex', 'claude', null] as const) {
      expect(
        resolveWindowsShiftEnterEncoding({
          foreground: { agent, shellForeground: false }
        })
      ).toBe('alt-enter')
    }
    expect(resolveWindowsShiftEnterEncoding({})).toBe('alt-enter')
  })

  it('lets current process identity override stale launch ownership', () => {
    expect(
      resolveWindowsShiftEnterEncoding({
        foreground: { agent: 'codex', routingTrusted: true, shellForeground: false },
        launchAgentType: 'claude'
      })
    ).toBe('alt-enter')
  })

  it('fails closed while a newer command generation awaits trusted evidence', () => {
    expect(
      resolveWindowsShiftEnterEncoding({
        foreground: { agent: 'claude', shellForeground: false },
        launchAgentType: 'claude'
      })
    ).toBe('alt-enter')
    expect(
      resolveWindowsShiftEnterEncoding({
        foreground: { agent: null, shellForeground: false },
        launchAgentType: 'claude'
      })
    ).toBe('alt-enter')
  })

  it('keeps launch ownership on its original leaf after a split sibling survives', () => {
    const state = {
      paneForegroundAgentByPaneKey: {},
      agentLaunchConfigByPaneKey: {
        'tab:launched-claude': { identity: { agentType: 'claude' } }
      }
    }

    expect(resolveWindowsShiftEnterEncodingForPane(state, 'tab:launched-claude')).toBe('alt-enter')
    // Why: after split→close leaves only the sibling, pane count is no longer
    // ownership evidence; the surviving leaf must keep the legacy fallback.
    expect(resolveWindowsShiftEnterEncodingForPane(state, 'tab:surviving-sibling')).toBe(
      'alt-enter'
    )
  })
})
