import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { findMissingKontextTools, readRequiredKontextTools } from './kontext-sidecar-tool-check.mjs'
import { selectVerifiedKontextSidecar } from './kontext-sidecar-selection.mjs'
import {
  KONTEXT_SIDECAR_ENV,
  KONTEXT_SIDECAR_SUBMODULE_DIR,
  listKontextSidecarCandidates,
  resolveKontextSidecarSource
} from './kontext-sidecar-source.mjs'

const repoRoot = path.resolve(import.meta.dirname, '../..')
const submoduleRoot = path.join(repoRoot, KONTEXT_SIDECAR_SUBMODULE_DIR)
const installHint = `pnpm --dir ${KONTEXT_SIDECAR_SUBMODULE_DIR} install`

function runInSubmodule(argv) {
  return spawnSync(process.execPath, argv, {
    cwd: submoduleRoot,
    stdio: 'inherit',
    windowsHide: true
  }).status
}

/**
 * The sidecar repository gitignores its bundle, so a fresh
 * `clone --recurse-submodules` carries the source but not the file. Build it
 * here instead of leaving every packager to discover that by hand.
 */
function buildSidecarFromSubmodule() {
  const bundler = path.join(submoduleRoot, 'scripts', 'bundle-plugin.mjs')
  if (!existsSync(bundler)) {
    return `submodule is not checked out (git submodule update --init ${KONTEXT_SIDECAR_SUBMODULE_DIR})`
  }
  if (!existsSync(path.join(submoduleRoot, 'node_modules'))) {
    return `its dependencies are missing (${installHint})`
  }
  // The bundler inlines every workspace package, so each one needs its dist first.
  const packageManager = process.env.npm_execpath
  if (!packageManager) {
    return 'this script was not run through pnpm, so its workspace cannot be built'
  }
  if (runInSubmodule([packageManager, '-r', 'build']) !== 0) {
    return `building its workspace failed (try ${installHint})`
  }
  return runInSubmodule([bundler]) === 0 ? null : 'bundling it failed'
}

const explicit = resolveKontextSidecarSource({ repoRoot })
if (explicit.source === 'environment' && explicit.status !== 'configured') {
  throw new Error(`${KONTEXT_SIDECAR_ENV} does not name a file: ${explicit.path}`)
}

const rejected = []
if (explicit.source !== 'environment') {
  const submoduleBuild = buildSidecarFromSubmodule()
  if (submoduleBuild) {
    rejected.push(`submodule: ${submoduleBuild}`)
  }
}

const requiredTools = readRequiredKontextTools(repoRoot)
const checkDataDirectory = mkdtempSync(path.join(tmpdir(), 'kondex-sidecar-check-'))
const { chosen, rejected: allRejected } = await selectVerifiedKontextSidecar({
  candidates:
    explicit.source === 'environment'
      ? [{ source: 'environment', path: explicit.path }]
      : listKontextSidecarCandidates(repoRoot),
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
console.log(`[kondex] Prepared Kontext sidecar from ${chosen.source}.`)
