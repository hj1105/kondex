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

Kontext Brain ships as a submodule, so a recursive clone gives you a working
checkout:

```bash
git clone --recurse-submodules <this repo>
# or, in an existing clone:
git submodule update --init --recursive

# The sidecar is a build artifact, not a committed file.
cd vendor/kontext-brain && pnpm install && pnpm -r build && pnpm bundle:plugin
```

The packaging scripts (`build:unpack`, `build:mac`, `build:linux`, `build:win`)
run that build themselves, so the manual step above is only needed for `pnpm dev`.

Kondex looks for the sidecar in this order: `KONDEX_KONTEXT_SIDECAR_PATH`, then
the submodule at `vendor/kontext-brain`, then a sibling checkout named
`kontext-brain-ts` or `kontext-brain-deepswe-eval`. The submodule wins over a
sibling because it is the revision this repository pins.

## Use

[docs/reference/usage.md](docs/reference/usage.md) ([한국어](docs/reference/usage.ko.md)) walks the loop once:
connect the places your decisions live — a GitHub repository URL is enough —
build the ontology, register evidence, plan a Task, run a worker on your own
subscription, and read the Context Receipt that proves what it was given.

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
