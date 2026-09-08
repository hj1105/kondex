import type { AgentTrustPreset } from './agent-trust-presets'
import { upsertProjectTrustLevelInContent } from './codex/config-toml-trust'
import { getActiveMultiplexer } from './ssh/ssh-target-registry'
import { getSshFilesystemProvider } from './providers/ssh-filesystem-dispatch'
import type { IFilesystemProvider } from './providers/types'
import {
  isWindowsAbsolutePathLike,
  normalizeRuntimePathSeparators
} from '../shared/cross-platform-path'

export async function markRemoteAgentWorkspaceTrusted(args: {
  preset: AgentTrustPreset
  connectionId: string
  workspacePath: string
}): Promise<void> {
  const home = await resolveRemoteHome(args.connectionId)
  const fsProvider = getSshFilesystemProvider(args.connectionId)
  if (!home || !fsProvider) {
    return
  }

  const workspacePath = await canonicalizeRemoteWorkspacePath(fsProvider, args.workspacePath)
  if (args.preset === 'codex') {
    await markRemoteCodexProjectTrusted(fsProvider, home, workspacePath)
  }
}

async function resolveRemoteHome(connectionId: string): Promise<string | null> {
  const mux = getActiveMultiplexer(connectionId)
  if (!mux || mux.isDisposed?.()) {
    return null
  }
  const result = (await mux.request('session.resolveHome', { path: '~' })) as {
    resolvedPath?: unknown
  }
  const home =
    typeof result.resolvedPath === 'string'
      ? normalizeRuntimePathSeparators(result.resolvedPath.trim())
      : ''
  return home &&
    (home.startsWith('/') || isWindowsAbsolutePathLike(home)) &&
    !hasRemotePathControlCharacter(home)
    ? home.replace(/\/$/, '')
    : null
}

function hasRemotePathControlCharacter(value: string): boolean {
  return value.includes(String.fromCharCode(0)) || value.includes('\r') || value.includes('\n')
}

async function canonicalizeRemoteWorkspacePath(
  fsProvider: IFilesystemProvider,
  workspacePath: string
): Promise<string> {
  try {
    return await fsProvider.realpath(workspacePath)
  } catch {
    return workspacePath
  }
}

async function readRemoteTextFile(
  fsProvider: IFilesystemProvider,
  filePath: string
): Promise<string> {
  try {
    const result = await fsProvider.readFile(filePath)
    return result.isBinary ? '' : result.content
  } catch {
    return ''
  }
}

async function markRemoteCodexProjectTrusted(
  fsProvider: IFilesystemProvider,
  remoteHome: string,
  workspacePath: string
): Promise<void> {
  const codexDir = `${remoteHome}/.codex`
  const configPath = `${codexDir}/config.toml`
  const existing = await readRemoteTextFile(fsProvider, configPath)
  const updated = upsertProjectTrustLevelInContent(existing, workspacePath, 'trusted', {
    // Why: workspacePath was resolved by the remote filesystem provider; local
    // realpath would canonicalize the wrong machine on SSH.
    alreadyCanonical: true
  })
  if (updated === existing) {
    return
  }
  await fsProvider.createDir(codexDir)
  await fsProvider.writeFile(configPath, updated)
}
