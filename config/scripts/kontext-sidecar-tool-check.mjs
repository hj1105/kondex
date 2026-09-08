import { readFileSync } from 'node:fs'
import path from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import {
  StdioClientTransport,
  getDefaultEnvironment
} from '@modelcontextprotocol/sdk/client/stdio.js'

const HANDSHAKE_TIMEOUT_MS = 30_000

export function readRequiredKontextTools(repoRoot) {
  const manifestPath = path.join(repoRoot, 'config', 'kontext-required-sidecar-tools.json')
  return JSON.parse(readFileSync(manifestPath, 'utf8')).tools
}

/**
 * Kondex declares the tools it calls, but nothing checked that the bundle being
 * packaged actually serves them — so a sidecar built from an older revision
 * shipped and only failed once a user tried to register a source.
 */
export async function findMissingKontextTools(serverPath, requiredTools, dataDirectory) {
  const client = new Client({ name: 'kondex-package-check', version: '1.0.0' })
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    cwd: path.dirname(serverPath),
    env: { ...getDefaultEnvironment(), KONTEXT_PLUGIN_DATA: dataDirectory },
    stderr: 'ignore'
  })
  try {
    await client.connect(transport, { timeout: HANDSHAKE_TIMEOUT_MS })
    const listed = new Set((await client.listTools()).tools.map((tool) => tool.name))
    return requiredTools.filter((name) => !listed.has(name))
  } finally {
    await client.close().catch(() => {})
  }
}
