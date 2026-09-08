import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import {
  KONTEXT_SIDECAR_ENV,
  KONTEXT_SIDECAR_SUBMODULE_DIR,
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
    return `Submodule is not checked out: git submodule update --init ${KONTEXT_SIDECAR_SUBMODULE_DIR}`
  }
  if (!existsSync(path.join(submoduleRoot, 'node_modules'))) {
    return `Sidecar dependencies are missing: ${installHint}`
  }
  // The bundler inlines every workspace package, so each one needs its dist first.
  const packageManager = process.env.npm_execpath
  if (!packageManager) {
    return 'Run this through pnpm so the sidecar workspace can be built.'
  }
  if (runInSubmodule([packageManager, '-r', 'build']) !== 0) {
    return `Building the sidecar workspace failed. Try ${installHint} first.`
  }
  return runInSubmodule([bundler]) === 0 ? null : 'Bundling the sidecar failed.'
}

let resolution = resolveKontextSidecarSource({ repoRoot })
let buildFailure = null
// Why: a package must carry the pinned submodule's sidecar, not whatever a
// sibling working tree happens to hold. Siblings stay a fallback for checkouts
// without the submodule, and an explicit path still wins.
if (resolution.source !== 'environment' && existsSync(submoduleRoot)) {
  buildFailure = buildSidecarFromSubmodule()
  resolution = buildFailure ? resolution : resolveKontextSidecarSource({ repoRoot })
}

if (resolution.status !== 'configured') {
  const detail =
    resolution.status === 'unavailable'
      ? `Configured path is not a file: ${resolution.path}`
      : `Checked: ${resolution.candidates.join(', ')}`
  throw new Error(
    `Kontext sidecar is required for a Kondex package. ${buildFailure ?? ''} Set ${KONTEXT_SIDECAR_ENV} to another checkout's plugins/kontext-brain/server.mjs to override. ${detail}`
  )
}

if (buildFailure && resolution.source !== 'submodule') {
  // Never let a package quietly carry a sibling working tree instead of the pin.
  console.warn(
    `[kondex] WARNING: packaging the ${resolution.source} sidecar, not the pinned submodule. ${buildFailure}`
  )
}

const destination = path.join(repoRoot, 'resources', 'kontext', 'server.mjs')
mkdirSync(path.dirname(destination), { recursive: true })
copyFileSync(resolution.path, destination)
console.log(`[kondex] Prepared Kontext sidecar from ${resolution.source}.`)
