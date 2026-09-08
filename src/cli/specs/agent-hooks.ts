import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'

export const AGENT_HOOK_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['agent', 'hooks', 'prepare-codex'],
    summary: 'Repair Kondex-managed Codex hook trust before a shell launch',
    usage: 'kondex agent hooks prepare-codex',
    allowedFlags: [...GLOBAL_FLAGS]
  },
  {
    path: ['agent', 'hooks', 'status'],
    summary: 'Show whether Kondex-managed agent status hooks are enabled',
    usage: 'kondex agent hooks status [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    examples: ['kondex agent hooks status', 'kondex agent hooks status --json']
  },
  {
    path: ['agent', 'hooks', 'off'],
    summary: 'Disable Kondex-managed agent status hooks and remove local hook entries',
    usage: 'kondex agent hooks off [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    examples: ['kondex agent hooks off']
  },
  {
    path: ['agent', 'hooks', 'on'],
    summary: 'Enable Kondex-managed agent status hooks',
    usage: 'kondex agent hooks on [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    examples: ['kondex agent hooks on']
  }
]
