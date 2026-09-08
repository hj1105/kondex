import { copyFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { resolveKontextSidecarSource } from './kontext-sidecar-source.mjs'

const repoRoot = path.resolve(import.meta.dirname, '../..')
const resolution = resolveKontextSidecarSource({ repoRoot })

if (resolution.status !== 'configured') {
  const detail =
    resolution.status === 'unavailable'
      ? `Configured path is not a file: ${resolution.path}`
      : `Checked: ${resolution.candidates.join(', ')}`
  throw new Error(
    `Kontext sidecar is required for a Kondex package. Set KONDEX_KONTEXT_SIDECAR_PATH to plugins/kontext-brain/server.mjs. ${detail}`
  )
}

const destination = path.join(repoRoot, 'resources', 'kontext', 'server.mjs')
mkdirSync(path.dirname(destination), { recursive: true })
copyFileSync(resolution.path, destination)
console.log(`[kondex] Prepared Kontext sidecar from ${resolution.source}.`)
