import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'

export const SKILL_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['skills', 'installed'],
    summary: 'List installed skill selectors',
    usage: 'kondex skills installed [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    notes: ['Lists discovery IDs and names without reading skill contents into the CLI.']
  },
  {
    path: ['skills', 'list'],
    summary: 'List version-matched skill guides bundled with this Kondex CLI',
    usage: 'kondex skills list [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    notes: [
      'Reads bundled guide metadata locally without contacting the Kondex runtime.',
      'With --json, prints a topics array of canonical names and one-line descriptions.',
      'Use `kondex skills get <name>` for the full guide, or `kondex skills install` to install skills.'
    ]
  },
  {
    path: ['skills', 'get'],
    aliases: [['skills', 'show']],
    summary: 'Print a version-matched skill guide as Markdown',
    usage: 'kondex skills get <topic> [--full] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'topic', 'full'],
    positionalArgs: ['topic'],
    notes: [
      'Reads bundled guide content locally without contacting the Kondex runtime.',
      'Use --full to include bundled reference documents when the guide provides them.',
      'Use --json for a deterministic object containing canonical topic metadata and content.'
    ],
    examples: ['kondex skills get orca-cli', 'kondex skills get orchestration --full']
  },
  {
    path: ['skills', 'install'],
    summary: 'Install version-matched skills bundled with Kondex, without network access',
    usage:
      'kondex skills install [--skill <name>]... [--all] [--agent <name>[,<name>]] ' +
      '[--local] [--dry-run] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'skill', 'all', 'agent', 'local', 'dry-run'],
    notes: [
      'Reads the bundled skill registry locally without contacting the Kondex runtime.',
      'Uses embedded discovery stubs and the local conflict-protected skill installer; no npx or repository download is required.',
      'Installs globally (all projects) by default. Use --local to install ' +
        'into the current project instead.',
      'Targets supported coding agents detected on this host, plus the shared .agents/skills directory. No detected agent means no install unless a target is explicitly selected.',
      'Use --agent <name>[,<name>...] to choose targets yourself, or --agent universal ' +
        'for the shared directory alone. Required when Kondex detects no agent.',
      'Use --dry-run to print the resolved command without running it.',
      'With --json, prints the listing, dry-run plan, or actual installation result as JSON.',
      'Keeps unowned or locally edited skills; conflicts return a nonzero exit code without discarding local files.',
      'Omit --skill and --all to list installable skill names.',
      'Intended for headless hosts (SSH, containers, CI) with no desktop Settings UI to copy the install command from.'
    ],
    examples: [
      'kondex skills install',
      'kondex skills install --skill orca-cli --skill orchestration',
      'kondex skills install --skill orca-cli --local',
      'kondex skills install --skill orca-cli --agent claude-code,codex',
      'kondex skills install --all --dry-run'
    ]
  },
  {
    path: ['skills', 'update'],
    summary: 'Refresh existing Kondex-managed skills from the bundled version',
    usage: 'kondex skills update [--skill <name>]... [--all] [--local] [--dry-run] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'skill', 'all', 'local', 'dry-run'],
    notes: [
      'Reads the bundled skill registry locally without contacting the Kondex runtime.',
      'Uses local bundled bytes without network access and preserves the existing installation targets.',
      'Updates the global install (all projects) by default. Use --local to ' +
        'update the current project instead.',
      'Only refreshes skills that are already installed; use `kondex skills install` first.',
      'Use --dry-run to print the resolved command without running it.',
      'With --json, prints the listing, dry-run plan, or actual update result as JSON.',
      'Skips missing or unmanaged skills; keeps local edits and reports conflicts with a nonzero exit code.',
      'Omit --skill and --all to list updatable skill names.',
      'Intended for headless hosts (SSH, containers, CI) with no desktop Settings UI to copy the update command from.'
    ],
    examples: [
      'kondex skills update',
      'kondex skills update --skill orca-cli --skill orchestration',
      'kondex skills update --skill orca-cli --local',
      'kondex skills update --all --dry-run'
    ]
  }
]
