# Contributing to Kondex

Thanks for contributing to Kondex.

## Before You Start

- Keep changes scoped to a clear user-facing improvement, bug fix, or refactor.
- Kondex targets macOS, Linux, and Windows. Every change must stay compatible with all three platforms unless the code is explicitly guarded by a runtime platform check.
- For keyboard shortcuts, use runtime platform checks in renderer code and `CmdOrCtrl` in Electron menu accelerators.
- For shortcut labels, show `⌘` and `⇧` on macOS, and `Ctrl+` and `Shift+` on Linux and Windows.
- For file paths, use Node or Electron path utilities such as `path.join`.
- Kondex must work against local repositories, remote servers, and SSH worktrees. Do not assume a process, file, credential, shell, or network path exists only on the local machine.
- Kondex supports Codex and Claude, plus multiple git providers. Keep generic behavior provider-neutral; guard provider-specific logic behind explicit checks.
- Keep changes well-engineered and performant: follow existing architecture, avoid unnecessary work in hot paths, clean up owned resources, and use concrete module names.
- For UI work, follow [`docs/STYLEGUIDE.md`](../docs/STYLEGUIDE.md), use the tokens and shadcn primitives it specifies, and verify polished behavior across platforms, light/dark mode, and SSH latency.

## Local Setup

```bash
pnpm install
pnpm dev
```

## Branch Naming

Use a clear, descriptive branch name that reflects the change.

Good examples:

- `fix/ctrl-backspace-delete-word`
- `feat/shift-enter-newline`
- `chore/update-contributor-guide`

Avoid vague names like `test`, `misc`, or `changes`.

## Before Opening a PR

Run the same checks that CI runs:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Add high-quality tests for behavior changes and bug fixes. Prefer tests that would actually catch a regression, not shallow coverage that only exercises the happy path.

If your change affects UI or interaction behavior, verify it on the platforms it could impact.

## Type Declarations: Prefer `.ts` Over `.d.ts`

Project-owned type declarations belong in `.ts` files. `.d.ts` is reserved for ambient shims (for example, `env.d.ts` or `vite/client.d.ts`). TypeScript's `skipLibCheck: true` setting applies globally, including to project `.d.ts` files, so unresolved references there can silently become `any` at call sites. Write project types in `.ts` files so the compiler checks them.

CI enforces this for `src/preload/` and `src/shared/`.

## Pull Requests

Each pull request should follow [`.github/pull_request_template.md`](./pull_request_template.md). In particular:

- open with an ELI5 of the change;
- explain what changed and why, and keep the PR focused;
- attach before-and-after screenshots or a short video for UI changes;
- add tests when behavior changes or bug fixes warrant them;
- include an AI-assisted review covering cross-platform, SSH/remote/local, provider, performance, UI, and security risks;
- call out platform-specific, remote-specific, agent-specific, or git-provider-specific behavior.

## Local Packaging

Kondex does not inherit Orca's release, updater publication, or Homebrew automation. Build packages locally with the platform command that matches the artifact you need:

```bash
pnpm build:unpack
pnpm build:mac
pnpm build:linux
pnpm build:win
```

Version bumps, signing, publication, and update channels require a separate Kondex release decision. Do not restore an upstream publishing workflow or change the package version in an ordinary contribution.
