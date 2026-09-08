import { realpath, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'

export type KontextSidecarPathResolution =
  | {
      status: 'configured'
      path: string
      source: 'environment' | 'packaged'
    }
  | {
      status: 'not_configured'
      expectedPath?: string
    }
  | {
      status: 'unavailable'
      path: string
      source: 'environment' | 'packaged'
      reason: string
    }

export type ResolveKontextSidecarPathOptions = {
  resourcesPath?: string
  environment?: NodeJS.ProcessEnv
}

export async function resolveKontextSidecarPath(
  options: ResolveKontextSidecarPathOptions
): Promise<KontextSidecarPathResolution> {
  const environment = options.environment ?? process.env
  const configuredPath = environment.KONDEX_KONTEXT_SIDECAR_PATH?.trim()
  if (configuredPath) {
    return inspectCandidate(resolve(configuredPath), 'environment', false)
  }

  if (!options.resourcesPath) {
    return { status: 'not_configured' }
  }

  const packagedPath = join(options.resourcesPath, 'kontext', 'server.mjs')
  return inspectCandidate(packagedPath, 'packaged', true)
}

async function inspectCandidate(
  candidatePath: string,
  source: 'environment' | 'packaged',
  missingMeansNotConfigured: boolean
): Promise<KontextSidecarPathResolution> {
  try {
    const candidateStat = await stat(candidatePath)
    if (!candidateStat.isFile()) {
      return {
        status: 'unavailable',
        path: candidatePath,
        source,
        reason: 'path is not a file'
      }
    }
    return { status: 'configured', path: await realpath(candidatePath), source }
  } catch (error) {
    if (missingMeansNotConfigured && isMissingPathError(error)) {
      return { status: 'not_configured', expectedPath: candidatePath }
    }
    return {
      status: 'unavailable',
      path: candidatePath,
      source,
      reason: error instanceof Error ? error.message : String(error)
    }
  }
}

function isMissingPathError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    ((error as NodeJS.ErrnoException).code === 'ENOENT' ||
      (error as NodeJS.ErrnoException).code === 'ENOTDIR')
  )
}
