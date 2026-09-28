import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { resolvePnpmCliInvocation } from './pnpm-cli-invocation.mjs'
import { describeSpawnFailure } from './kontext-sidecar-build.mjs'
import { findMissingKontextTools, readRequiredKontextTools } from './kontext-sidecar-tool-check.mjs'
import { selectVerifiedKontextSidecar } from './kontext-sidecar-selection.mjs'
import {
  KONTEXT_SIDECAR_BUNDLE_PATH,
  KONTEXT_SIDECAR_ENV,
  KONTEXT_SIDECAR_SUBMODULE_DIR,
  listKontextSidecarCandidates,
  resolveKontextSidecarSource
} from './kontext-sidecar-source.mjs'

const repoRoot = path.resolve(import.meta.dirname, '../..')
const submoduleRoot = path.join(repoRoot, KONTEXT_SIDECAR_SUBMODULE_DIR)
const installHint = `pnpm --dir ${KONTEXT_SIDECAR_SUBMODULE_DIR} install`

function runInSubmodule({ command, args, shell = false }) {
  return describeSpawnFailure(
    spawnSync(command, args, {
      cwd: submoduleRoot,
      stdio: 'inherit',
      shell,
      windowsHide: true
    })
  )
}

/**
 * The sidecar repository gitignores its bundle, so a fresh
 * `clone --recurse-submodules` carries the source but not the file. Build it
 * here instead of leaving every packager to discover that by hand.
 *
 * Returns `unavailable` when there is nothing to build with (packaging may fall
 * back to a sibling with a warning) and `failed` when a build ran and broke.
 */
function buildSidecarFromSubmodule() {
  const bundler = path.join(submoduleRoot, 'scripts', 'bundle-plugin.mjs')
  if (!existsSync(bundler)) {
    return {
      status: 'unavailable',
      reason: `submodule is not checked out (git submodule update --init ${KONTEXT_SIDECAR_SUBMODULE_DIR})`
    }
  }
  if (!existsSync(path.join(submoduleRoot, 'node_modules'))) {
    return { status: 'unavailable', reason: `its dependencies are missing (${installHint})` }
  }
  // The bundler inlines every workspace package, so each one needs its dist first.
  const pnpm = resolvePnpmCliInvocation()
  const workspaceBuild = runInSubmodule({
    command: pnpm.command,
    args: [...pnpm.prefixArgs, '-r', 'build'],
    shell: pnpm.shell
  })
  if (workspaceBuild) {
    return { status: 'failed', reason: `\`pnpm -r build\` ${workspaceBuild} (try ${installHint})` }
  }
  const bundle = runInSubmodule({ command: process.execPath, args: [bundler] })
  return bundle
    ? { status: 'failed', reason: `scripts/bundle-plugin.mjs ${bundle}` }
    : { status: 'built' }
}

const explicit = resolveKontextSidecarSource({ repoRoot })
if (explicit.source === 'environment' && explicit.status !== 'configured') {
  throw new Error(`${KONTEXT_SIDECAR_ENV} does not name a file: ${explicit.path}`)
}

const rejected = []
let candidates = [{ source: 'environment', path: explicit.path }]
if (explicit.source !== 'environment') {
  const submoduleBuild = buildSidecarFromSubmodule()
  if (submoduleBuild.status === 'failed') {
    // Why: the previous bundle is still on disk, and packaging it would ship a
    // sidecar that no longer matches the pinned source without anyone noticing.
    throw new Error(
      `Building the Kontext sidecar in ${KONTEXT_SIDECAR_SUBMODULE_DIR} failed: ${submoduleBuild.reason}. ` +
        `Refusing to package the stale bundle. To package an existing bundle as-is, set ` +
        `${KONTEXT_SIDECAR_ENV}=${KONTEXT_SIDECAR_SUBMODULE_DIR}/${KONTEXT_SIDECAR_BUNDLE_PATH.join('/')}.`
    )
  }
  candidates = listKontextSidecarCandidates(repoRoot)
  if (submoduleBuild.status === 'unavailable') {
    rejected.push(`submodule: ${submoduleBuild.reason}`)
    // A bundle left over from an earlier build was not rebuilt from the pinned source.
    candidates = candidates.filter((candidate) => candidate.source !== 'submodule')
  }
}

const requiredTools = readRequiredKontextTools(repoRoot)
const checkDataDirectory = mkdtempSync(path.join(tmpdir(), 'kondex-sidecar-check-'))
const { chosen, rejected: allRejected } = await selectVerifiedKontextSidecar({
  candidates,
  exists: existsSync,
  findMissingTools: (candidatePath) =>
    findMissingKontextTools(candidatePath, requiredTools, checkDataDirectory),
  priorRejections: rejected
})

if (!chosen) {
  throw new Error(
    `No Kontext sidecar can serve the tools Kondex calls. Rejected — ${allRejected.join('; ')}. Set ${KONTEXT_SIDECAR_ENV} to a bundle built from a revision that has them.`
  )
}

if (chosen.source !== 'submodule' && chosen.source !== 'environment') {
  // Never let a package quietly carry a working tree instead of the pinned revision.
  console.warn(
    `[kondex] WARNING: packaging the ${chosen.source} sidecar at ${chosen.path}, not the pinned submodule — ${allRejected.join('; ')}`
  )
}

const destination = path.join(repoRoot, 'resources', 'kontext', 'server.mjs')
mkdirSync(path.dirname(destination), { recursive: true })
copyFileSync(chosen.path, destination)
// Why: a packaged app has no checkout to run the ontology CLI from, so the
// single-file build that ships beside the sidecar travels with it.
const ontologyCli = path.join(path.dirname(chosen.path), 'ontology-cli.mjs')
if (existsSync(ontologyCli)) {
  copyFileSync(ontologyCli, path.join(repoRoot, 'resources', 'kontext', 'ontology-cli.mjs'))
} else {
  console.warn(
    `[kondex] WARNING: no ontology-cli.mjs beside ${chosen.path}; the packaged app cannot connect ontology sources.`
  )
}
// Why: the built-in search embedder runs ONNX Runtime's WebAssembly build, whose
// binary and loader are fetched from the directory the CLI sits in at run time.
for (const asset of ['ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm']) {
  const source = path.join(path.dirname(chosen.path), asset)
  if (existsSync(source)) {
    copyFileSync(source, path.join(repoRoot, 'resources', 'kontext', asset))
  } else {
    console.warn(
      `[kondex] WARNING: no ${asset} beside ${chosen.path}; the packaged app falls back to lexical search.`
    )
  }
}
console.log(`[kondex] Prepared Kontext sidecar from ${chosen.source}.`)
