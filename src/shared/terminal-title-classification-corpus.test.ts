import { describe, expect, it } from 'vitest'
import { getAgentLabel, isClaudeAgent } from './agent-title-identity'
import { detectAgentStatusFromTitle } from './agent-title-status'
import { TERMINAL_TITLE_CLASSIFICATION_CORPUS } from './terminal-title-classification-corpus'
import {
  resolveExplicitTerminalTitleAgentType,
  resolveTerminalTitleAgentType
} from './terminal-title-agent-type'

type PinnedRow = [
  title: string,
  status: string | null,
  label: string | null,
  claude: boolean,
  titleAgent: string | null,
  explicitTitleAgent: string | null
]

// Activity labels and committed identity are separate contracts; generic glyphs do not prove ownership.
const PINNED_CLASSIFICATIONS: readonly PinnedRow[] = [
  ['', null, null, false, null, null],
  ['zsh', null, null, false, null, null],
  ['bash', null, null, false, null, null],
  ['nwparker@mac: ~/orca', null, null, false, null, null],
  ['npm run dev', null, null, false, null, null],
  ['claude-scratch', null, null, false, null, null],
  ['~/codex/ready', null, null, false, null, null],
  ['review-14600-codex', null, null, false, null, null],
  ['timestamp ready', null, null, false, null, null],
  ['android build running', null, null, false, null, null],
  ['C:\\tools\\codex\\run', null, null, false, null, null],
  ['/usr/local/bin/claude/notes', null, null, false, null, null],
  ['codex.exe', 'idle', 'Codex', false, 'codex', 'codex'],
  ['claude.bat working', 'working', 'Claude Code', true, 'claude', 'claude'],
  ['✳', 'idle', 'Claude Code', true, 'claude', null],
  ['✳ Claude Code', 'idle', 'Claude Code', true, 'claude', 'claude'],
  ['✳ ready', 'idle', 'Claude Code', true, 'claude', null],
  ['. building the parser', 'working', 'Claude Code', true, 'claude', null],
  ['* done', 'idle', 'Claude Code', true, 'claude', null],
  ['Claude Code', 'idle', 'Claude Code', true, 'claude', 'claude'],
  ['claude - action required', 'permission', 'Claude Code', true, 'claude', 'claude'],
  ['Claude ready', 'idle', 'Claude Code', true, 'claude', 'claude'],
  ['claude agents', null, null, false, null, null],
  ['"/usr/local/bin/claude" agents', null, null, false, null, null],
  ['⠋ Claude Code', 'working', 'Claude Code', true, 'claude', 'claude'],
  ['⠉ Codex — refactoring', 'working', 'Codex', false, 'codex', 'codex'],
  ['◐ working', 'working', 'Claude Code', true, 'claude', null],
  ['codex working', 'working', 'Codex', false, 'codex', 'codex'],
  ['codex ready', 'idle', 'Codex', false, 'codex', 'codex'],
  // Upstream pins this as idle too: a recognised agent noun with an idle keyword
  // reads as idle status, while the label stays null so nothing claims it is an
  // agent pane by name.
  ['cursor position reset', 'idle', null, false, null, null],
  ['zsh | ⠋ Codex', 'working', 'Codex', false, 'codex', 'codex'],
  ['tmux | claude - action required', 'permission', null, false, null, null],
  ['ssh host | codex ready', 'idle', 'Codex', false, 'codex', 'codex']
]

describe('terminal title classification', () => {
  it('covers every corpus title exactly once', () => {
    expect(PINNED_CLASSIFICATIONS.map(([title]) => title)).toEqual([
      ...TERMINAL_TITLE_CLASSIFICATION_CORPUS
    ])
  })

  it.each(PINNED_CLASSIFICATIONS)(
    'classifies %j consistently before and after memoization',
    (title, status, label, claude, titleAgent, explicitTitleAgent) => {
      for (let read = 0; read < 2; read++) {
        expect(detectAgentStatusFromTitle(title)).toBe(status)
        expect(getAgentLabel(title)).toBe(label)
        expect(isClaudeAgent(title)).toBe(claude)
        expect(resolveTerminalTitleAgentType(title)).toBe(titleAgent)
        expect(resolveExplicitTerminalTitleAgentType(title)).toBe(explicitTitleAgent)
      }
    }
  )
})
