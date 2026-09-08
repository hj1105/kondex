import { z } from 'zod'

/** Agent identity carried with a launch so reconnect and UI restoration can recover its provider. */
export const AGENT_KIND_VALUES = ['claude-code', 'codex', 'other'] as const
export const agentKindSchema = z.enum(AGENT_KIND_VALUES)
export type AgentKind = (typeof AGENT_KIND_VALUES)[number]

export const LAUNCH_SOURCE_VALUES = [
  'command_palette',
  'sidebar',
  'quick_command',
  'tab_bar_quick_launch',
  'task_page',
  'new_workspace_composer',
  'workspace_jump_palette',
  'shortcut',
  'onboarding',
  'diff_notes_send',
  'notes_send',
  'conflict_resolution',
  'source_control_recovery',
  'terminal_context_menu',
  'unknown'
] as const
export type LaunchSource = (typeof LAUNCH_SOURCE_VALUES)[number]

export const REQUEST_KIND_VALUES = ['new', 'resume', 'followup'] as const
export type RequestKind = (typeof REQUEST_KIND_VALUES)[number]

export type AgentLaunchContext = {
  agent_kind: AgentKind
  launch_source: LaunchSource
  request_kind: RequestKind
}
