import { statSync } from 'node:fs'
import path from 'node:path'

export const KONTEXT_SIDECAR_ENV = 'KONDEX_KONTEXT_SIDECAR_PATH'

const SIBLING_PROJECT_NAMES = ['kontext-brain-ts', 'kontext-brain-deepswe-eval']

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

  const candidates = SIBLING_PROJECT_NAMES.map((projectName) =>
    path.resolve(repoRoot, '..', projectName, 'plugins', 'kontext-brain', 'server.mjs')
  )
  const siblingPath = candidates.find(isFile)
  return siblingPath
    ? { status: 'configured', source: 'sibling', path: siblingPath }
    : { status: 'not_configured', candidates }
}

export function configureDevKontextSidecarEnvironment(options) {
  const resolution = resolveKontextSidecarSource(options)
  if (resolution.status === 'configured' && resolution.source === 'sibling') {
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
