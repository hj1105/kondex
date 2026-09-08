---
name: kondex-cli
description: >-
  Use the public `kondex` CLI to operate Kondex-managed worktrees, folder contexts,
  terminals, repos, automations, worktree comments, and the browser
  embedded inside the Kondex app. Use when the user says "$kondex-cli", "use kondex cli",
  "Kondex worktree", "child worktree", "cardStatus", "spawn codex/claude in a worktree",
  "read/wait/send Kondex terminal", "terminal send", "full handoff", "handover",
  "give this to another agent", "another worktree", "Kondex browser", or "control the browser inside
  Kondex". Prefer this over raw `git worktree`, ad hoc
  PTYs, Playwright, or Computer Use when the task touches Kondex-managed state.
  Use Computer Use for external browser windows, webviews, or desktop UI only
  when the task requires OS/window-level control such as focus, menus, dialogs,
  coordinates, or screenshots. Use `kondex-cli` for Kondex's embedded pages and a
  page-automation tool such as Playwright or CDP for external pages.
---

# Kondex CLI

This file is a discovery stub, not the usage guide. The full, version-matched Kondex CLI
reference is served by the `kondex` binary itself — kept out of this file on purpose so it
can never drift from the binary that will actually run your commands.

Engage Kondex whenever its running editor/runtime is the source of truth: Kondex-managed
worktrees, folder contexts, terminals, repos, automations, worktree comments, and the
browser embedded inside the Kondex app. Triggers include "$kondex-cli", "Kondex worktree",
"child worktree", "spawn codex/claude in a worktree", "read/wait/send Kondex terminal",
"full handoff" / "handover" / "give this to another agent", and "control the browser
inside Kondex". Use plain shell tools when Kondex state does not matter.

## Resolve the CLI for this session

Choose the executable once and reuse it for every later command:

- Use `KONDEX_CLI_COMMAND` when set.
- Otherwise, use the compatibility `ORCA_CLI_COMMAND` value only when this session
  belongs to Kondex; it may name the legacy `orca` bridge on an SSH host.
- Otherwise, in a dev session exposing `ORCA_DEV_REPO_ROOT`, use `kondex-dev`.
- Otherwise, use `kondex` on macOS, Linux, and Windows.

Below, `KONDEX` is a placeholder for the executable you resolved. Substitute it before
running anything; do not create a shell variable or run `KONDEX` literally. This works the
same way in POSIX shells, PowerShell, and cmd.exe.

If the selected executable cannot run, report its exact error and stop. Do not fall through
to another executable, which could silently target a different Kondex build.

## Load the full guide before running Kondex commands

```text
KONDEX skills get kondex-cli
```

That prints the complete, version-matched guide for the exact binary that will handle your
next commands — worktrees, handoffs, terminals, automations, and the built-in browser.
Read it first, then run the specific command you need.

Don't guess subcommands or flags from memory or from a cached copy of this stub. They
change between Kondex releases, and this file deliberately no longer lists them. Confirm the
app is up with `KONDEX status --json` (start it with `KONDEX open --json` if needed), and
prefer `--json` for agent-driven calls.

## If an older Kondex does not recognize `skills get`

Use this fallback only when the selected binary explicitly reports that `skills get` is an
unknown command. Another failure is not proof of an older binary; report it rather than
guessing or changing executables. For a confirmed pre-guide binary, use only this bounded,
read-only bootstrap to orient. Do not dead-end and do not invent commands:

```text
KONDEX status --json
KONDEX worktree ps --json
KONDEX terminal list --json
```

Then tell the user that updating Kondex restores the full, version-matched guide via
`KONDEX skills get kondex-cli`. Beyond these commands, ask the user rather than guessing a
command surface this older binary may not support.
