# Kondex

Kondex is a local-first desktop IDE for evidence-backed agentic development. It combines Orca's editor, terminal, source-control, worktree, and agent-runtime foundation with Kontext Brain's decision evidence and provenance.

The current product direction is:

- the main task coordinates the overall change;
- behavior-bearing symbols become logic-scoped work items;
- Codex and Claude workers implement those work items independently;
- each worker retrieves the relevant Kontext evidence before changing code;
- the coordinator reviews and integrates the results.

Kondex is under active development and is not yet distributed as a public release. It does not use Orca Cloud, Orca's update channels, Homebrew casks, or release repositories.

## Requirements

- Node.js 24
- pnpm 12
- Codex CLI and/or Claude Code, authenticated with the user's existing subscription
- a Kontext Brain sidecar

For development, place a Kontext Brain checkout that contains
`plugins/kontext-brain/server.mjs` beside this repository. The supported sibling checkout names are
`kontext-brain-ts` and `kontext-brain-deepswe-eval`. Alternatively, set
`KONDEX_KONTEXT_SIDECAR_PATH` to the sidecar bundle explicitly.

## Develop

```bash
pnpm install
pnpm dev
```

Useful verification commands:

```bash
pnpm typecheck
pnpm test
pnpm run check:code-quality:changed
```

## Package Locally

Packaging copies the configured Kontext sidecar into the app resources before Electron Builder runs.

```bash
pnpm build:unpack
pnpm build:mac
pnpm build:linux
pnpm build:win
```

These commands build local Kondex artifacts. Signing, public distribution, and automatic updates require a separate Kondex release design and are intentionally not inherited from Orca.

## Project Status

The desktop shell and Kontext sidecar integration exist. The logic-work-item experience, runtime inspection, and local packaging path are being hardened before distribution.

See [CONTRIBUTING.md](.github/CONTRIBUTING.md) for contribution and validation guidance.

## Upstream and License

Kondex is based on the open-source Orca desktop application. Original Orca copyright notices remain with their respective files and contributors.

This repository is licensed under the [MIT License](LICENSE).
