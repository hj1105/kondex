import { statSync } from 'node:fs'
import path from 'node:path'

export const KONTEXT_SIDECAR_ENV = 'KONDEX_KONTEXT_SIDECAR_PATH'

const SIBLING_PROJECT_NAMES = ['kontext-brain-ts', 'kontext-brain-deepswe-eval']
// Why: the submodule makes `git clone --recurse-submodules` a working checkout;
// without this the sidecar is only found when it happens to sit beside the repo.
const SUBMODULE_PATH = ['vendor', 'kontext-brain']
export const KONTEXT_SIDECAR_SUBMODULE_DIR = SUBMODULE_PATH.join('/')
// The sidecar repository gitignores this bundle, so a fresh checkout has to build it.
export const KONTEXT_SIDECAR_BUNDLE_PATH = ['plugins', 'kontext-brain', 'server.mjs']

export function resolveKontextSidecarSource({
  repoRoot,
  environment = process.env,
  isFile = defaultIsFile
}) {
  const explicitPath = environment[KONTEXT_SIDECAR_ENV]?.trim()
  if (explicitPath) {
    const resolvedPath = path.resolve(repoRoot, explicitPath)
    return isFile(resolvedPath)
      ? { status: 'configured', source: 'environment', path: resolvedPath }
      : { status: 'unavailable', source: 'environment', path: resolvedPath }
  }

  const submodulePath = path.resolve(repoRoot, ...SUBMODULE_PATH, ...KONTEXT_SIDECAR_BUNDLE_PATH)
  if (isFile(submodulePath)) {
    return { status: 'configured', source: 'submodule', path: submodulePath }
  }

  const candidates = SIBLING_PROJECT_NAMES.map((projectName) =>
    path.resolve(repoRoot, '..', projectName, ...KONTEXT_SIDECAR_BUNDLE_PATH)
  )
  const siblingPath = candidates.find(isFile)
  return siblingPath
    ? { status: 'configured', source: 'sibling', path: siblingPath }
    : { status: 'not_configured', candidates: [submodulePath, ...candidates] }
}

export function configureDevKontextSidecarEnvironment(options) {
  const resolution = resolveKontextSidecarSource(options)
  if (resolution.status === 'configured' && resolution.source !== 'environment') {
    options.environment[KONTEXT_SIDECAR_ENV] = resolution.path
  }
  return resolution
}

function defaultIsFile(candidatePath) {
  try {
    return statSync(candidatePath).isFile()
  } catch {
    return false
  }
}
