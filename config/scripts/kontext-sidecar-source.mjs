import { statSync } from 'node:fs'
import path from 'node:path'

export const KONTEXT_SIDECAR_ENV = 'KONDEX_KONTEXT_SIDECAR_PATH'

const SIBLING_PROJECT_NAMES = ['kontext-brain-ts', 'kontext-brain-deepswe-eval']
// Why: the submodule makes `git clone --recurse-submodules` a working checkout;
// without this the sidecar is only found when it happens to sit beside the repo.
const SUBMODULE_PATH = ['vendor', 'kontext-brain']

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

  const submodulePath = path.resolve(
    repoRoot,
    ...SUBMODULE_PATH,
    'plugins',
    'kontext-brain',
    'server.mjs'
  )
  if (isFile(submodulePath)) {
    return { status: 'configured', source: 'submodule', path: submodulePath }
  }

  const candidates = SIBLING_PROJECT_NAMES.map((projectName) =>
    path.resolve(repoRoot, '..', projectName, 'plugins', 'kontext-brain', 'server.mjs')
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
