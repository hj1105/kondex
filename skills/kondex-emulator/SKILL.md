---
name: kondex-emulator
description: >
  Control a mobile (iOS) emulator / simulator stream from inside Kondex using the `kondex` CLI.
  Use for taps, gestures, typing, hardware buttons, camera injection, permissions, accessibility tree, and more — all while seeing the live view in Kondex's emulator pane.
  Prefer this over raw `npx serve-sim` or direct simctl when running agents inside Kondex (the kondex surface handles device scoping, helper lifecycle, and worktree context).
  Complements the kondex-cli skill for terminals, worktrees, and the built-in browser.
license: Apache-2.0
---

# Kondex Emulator

This file is a discovery stub, not the usage guide. The full, version-matched Kondex emulator
reference is served by the `kondex` binary itself — kept out of this file on purpose so it can
never drift from the binary that will actually run your commands.

Engage Kondex whenever you drive a mobile (iOS) emulator / simulator stream from inside the
Kondex app: taps, gestures, typing, hardware buttons, camera injection, runtime permissions,
the accessibility tree, and more — all while the live view stays in Kondex's emulator pane.
Prefer this over raw `serve-sim` or direct `simctl` when running agents inside Kondex, which
handles device scoping, helper lifecycle, and worktree context for you. It complements the
kondex-cli skill for terminals, worktrees, and the built-in browser.

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
KONDEX skills get kondex-emulator
```

That prints the complete, version-matched guide for the exact binary that will handle your
next commands — booting devices, taps and gestures, typing, hardware buttons, camera
injection, permissions, and the accessibility tree. Read it first, then run the specific
command you need.

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
KONDEX emulator list --json
```

Then tell the user that updating Kondex restores the full, version-matched guide via
`KONDEX skills get kondex-emulator`. Beyond these commands, ask the user rather than guessing a
command surface this older binary may not support.
