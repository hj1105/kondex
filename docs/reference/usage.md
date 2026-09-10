# Using Kondex

[English](./usage.md) | [한국어](./usage.ko.md)

Kondex gives coding agents the right organizational context before they change
code. This guide walks the loop once: connect the places your decisions live,
build an ontology from them, register the evidence a change should respect, plan
a Task, run a worker on your own subscription, and read the Context Receipt that
proves what the worker was given.

## Before you start

- Node.js 24 and pnpm 12.
- Codex CLI (`codex login`) and/or Claude Code (`claude`) signed in with your
  subscription. Kondex never asks for an API key; it drives the CLI you already
  pay for.
- The Kontext sidecar. A recursive clone builds it during packaging; for
  `pnpm dev`, follow the sidecar steps in the [README](../../README.md).

Start the app with `pnpm dev`, or open the package `pnpm build:unpack` produced
under `dist/`.

## 1. Add a project

Open a folder or a Git repository from the landing screen (or the workspace
composer's **Add project** once a project exists). Everything below is scoped to
that workspace; its `kontext.yaml` lives at the workspace root.

## 2. Connect sources and build the ontology

Sidebar **Logic Work Items** → **Ontology sources**. Four numbered steps; each one
shows what is there before it changes anything.

1. **Choose a workspace** — the one whose `kontext.yaml` will hold the sources.
2. **Connect sources**
   - **GitHub repository** — paste the address you would give `git clone`.
     Kondex clones it (shallow) into a cache and reads its Markdown like a
     local folder; every check and build refreshes the checkout first. Private
     repositories work exactly as far as your own `git` sign-in does — no token
     is stored. Set **Branch or tag** to read something other than the default
     branch. The cache lives under `~/.cache/kontext-brain/git-sources`
     (override with `KONTEXT_GIT_SOURCE_CACHE`).
   - **GitHub organization** — paste `https://github.com/<org>` and **Load
     repositories**. The list comes through your own `gh` login, so private
     repositories appear as far as it can see and no token is stored. Working
     repositories are ticked by default; archived ones and forks are hidden
     until you include them. **Add N selected** adds each as its own git source
     named `<org>-<repo>`.
   - **Also read source code** — on a repository, organization or Markdown
     source, each directory of TypeScript, JavaScript or Python becomes one
     module document described by what it exports, classified onto ontology
     nodes beside the documents that govern it (the code ontology). Up to 80
     modules per source, the ones exporting most first; tests, declarations and
     generated files are skipped. In `kontext.yaml` this is `code: true`.
   - **Import from Claude / Codex** — brings over MCP servers you already
     configured for those agents (Notion, Slack, Jira, GitHub…). **Preview
     import** lists what would be added before anything is written.
   - **Notion / Jira / Slack** — SSE servers; paste the server URL the provider
     gave you.
   - **GitHub MCP server** — a stdio server for pull-request and issue tooling.
     Put the command in **Command** (`npx`), one argument per line
     (`-y`, `@modelcontextprotocol/server-github`), and the token in
     **Environment** as `GITHUB_PERSONAL_ACCESS_TOKEN=…`. Environment values are
     written to `kontext.yaml`. For plain repository documents prefer the
     GitHub repository preset above — it needs neither a server nor a token.
   - **Markdown** — a local directory. **Also use this workspace's own
     Markdown** adds the current repository's `.md` files.
3. **Check they answer** — connects to every source and shows how many
   documents each exposes. A source that does not answer is named; building now
   would leave its documents out.
4. **Build the ontology** — **Preview** shows how many nodes would be created
   without saving; **Build and save** writes them to `kontext.yaml`. Leave the
   node count empty to let the builder choose (3–200). Building sends collected
   document titles to the model named in `kontext.yaml`; with `provider: codex`
   that is your logged-in Codex subscription. When the file names no model
   (Kondex writes only sources), setup uses `provider: codex` and records that
   in `kontext.yaml`; edit the `llm:` section there to use Claude, OpenAI or
   Ollama instead. It starts no agent and approves no
   decision.

The same steps exist as a CLI in the sidecar checkout:

```
kontext-ontology list
kontext-ontology import-mcp --from claude,codex --project . [--markdown .] --write
kontext-ontology add --name handbook --transport git --url https://github.com/org/handbook.git [--ref main] --write
kontext-ontology add --name github --transport stdio --command npx --arg -y --arg @modelcontextprotocol/server-github --env GITHUB_PERSONAL_ACCESS_TOKEN=… --write
kontext-ontology check
kontext-ontology setup [--target-nodes 40] --write
```

## 3. Register evidence

Still under **Logic Work Items**:

- **Markdown sources** — register a saved Markdown file from the selected
  workspace (path relative to the workspace). Registration captures a content
  version and returns a Resource ID; it grants no model access by itself.
- **Sessions** — register Codex or Claude session journals as evidence with the
  same review step.
- **Source model permissions** — choose which runtime (Codex, Claude) may read
  each registered source, confirm, and save. Permissions apply to the captured
  content version; changed content needs new permission.

## 4. Plan, approve, run, verify

1. **What should change?** — describe the change. Pick the **Coding workspace**
   and choose the registered sources the plan must respect (**Browse registered
   sources**). Tick **Use my selected subscription** and **Generate plan**. The
   planner runs read-only on your subscription and returns a Task draft: code
   revision, context digest, targets, acceptance criteria, Logic Work Items with
   their planned symbols, and the evidence IDs it used.
2. Review. **Request a revised draft** sends feedback and keeps the parent
   draft's digest. Tick **I approve this exact task** and **Approve and register
   Task**. Nothing has been implemented yet.
3. **Registered tasks** — the Task ID and worktree are prefilled. Choose the
   **Implementation runtime** and worker count, tick **Allow subscription CLI
   execution…**, and **Start schedule**. Each worker fetches its Task context
   before it may write; the sidecar issues a **Context Receipt** for that fetch
   and refuses writes outside the receipt's allowed paths.
4. **Refresh / revalidate** shows the run state. **Integrate and verify** runs
   the planned verifiers and independent review; **Assess completion** checks
   the completion evidence. Runner completion is never treated as verified Task
   completion.

5. **Read what each node holds** — **Show nodes and their documents** lists
   every node with how many documents the knowledge graph filed under it and a
   few of them by source. A node with nothing under it is a topic the build
   imagined; merge or drop it in `kontext.yaml` and rebuild. While a build runs,
   step 4 shows the phase and batch it is on (discovering topics, classifying
   documents, writing knowledge, projecting code), and a toast reports the saved
   node count when it finishes.
6. **Ask the knowledge graph** — type a question and get Evidence-cited chunks
   from the connected documents and code, filtered by node if you like. Workers
   reach the same search as the `kontext_search_knowledge` tool, so a question
   about a decision or a module is answered from the graph instead of a fresh
   crawl of the repositories. From a shell: `kontext-ontology query --question
"…" --data-dir <userData>/kontext` and `kontext-ontology nodes --data-dir …`.

### Where knowledge lives

A build writes every document and code module — Notion pages, Markdown, one
Resource per source file with a Chunk per symbol — into the Task sidecar's
SQLite graph under `<userData>/kontext`, with the ontology nodes the
classifier assigned. `kontext.yaml` keeps only the node schema. Nothing is
sent anywhere but the model you configured.

### Trusted verifiers

Kontext only runs verifiers the workspace itself declares, and most projects
already do through their manifests, so nothing needs to be added:

- `package.json` scripts named `lint`/`eslint`/`biome`/`oxlint`, `test`,
  `typecheck`/`type-check`/`check-types`/`tsc`, `build`, run with the package
  manager the `packageManager` field or lockfile names;
- `pyproject.toml`/`setup.py`: `python3 -m pytest -q` when tests are
  configured, `ruff check .` and `python3 -m mypy .` when those tools are
  configured;
- `go.mod`: `go vet`, `go test`, `go build` over `./...`;
- `Cargo.toml`: `cargo clippy`, `cargo test`, `cargo build`;
- `Makefile` targets `lint`, `test`, `typecheck`, `build`.

These appear as `workspace:lint`, `workspace:test`, `workspace:typecheck`,
`workspace:build`. Installed dependencies (`node_modules`, `.venv`) are linked
into each runtime worktree automatically. Only a project whose checks are
unusual needs `.kontext/verifiers.json` at the repository root:

```json
{
  "schemaVersion": 1,
  "verifiers": [
    {
      "kind": "lint",
      "ref": "pnpm run check:code-quality:changed",
      "command": "pnpm",
      "args": ["run", "check:code-quality:changed"],
      "timeoutMilliseconds": 600000
    }
  ],
  "linkedDirectories": ["node_modules"]
}
```

The planner is told this list and may only pick from it, so a Task never names a
check the workspace cannot execute. Commands run without a shell, in the
worker's runtime worktree. That worktree is a fresh checkout, so list the
untracked directories your verifiers need (an installed `node_modules`, a
`.venv`) under `"linkedDirectories"`; Kontext links them from your checkout
instead of reinstalling. Kontext's own fast checks (semantic sync, stable symbol
identity, domain-term and graph-query checks) are judged from the sidecar's
observation of the patch and need no entry.

A Codex worker gets the Kontext tools and write hooks injected for its own
`codex exec` only; nothing is written into `~/.codex`. The Change Bundle it
submits must carry the patch digest, changed paths, changed symbols and
verification run IDs that `kontext_check_change` returned; a bundle built from
guesses is rejected with `patch_mismatch` or `missing_verification`.

### Where the receipt is

The sidecar keeps the receipt beside the write capability it authorized, under
the app's user-data directory:

```
<userData>/kontext/write-capabilities/<sha256(workspace path)>.json
  → binding.receipt = { receiptId, taskId, workItemId, plannedSymbolIds,
                        allowedPaths, contextDigest, normativeRevisions,
                        evidenceIds, issuedAt, expiresAt }
```

`receiptId` is a hash over exactly those fields, so a receipt cannot be edited
to claim different evidence after the fact. Completion evidence in
`<userData>/kontext/task-completion/` references receipts by ID.

## Troubleshooting

- **"Cannot reach the Kontext sidecar"** — the sidecar bundle is missing. Build
  it as the README describes, or set `KONDEX_KONTEXT_SIDECAR_PATH`.
- **Codex shows "Sign-in required"** — run `codex login` in a terminal; Kondex
  reuses that session.
- **A source "Did not answer"** — for a server, run its command yourself; for a
  repository, run `git clone <url>` yourself. Kondex has no credentials of its
  own.
- **A worker was refused a write** — the path was outside its receipt's
  `allowedPaths`. That is the guard working; widen the plan, not the guard.
