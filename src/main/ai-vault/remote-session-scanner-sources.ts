import type { AiVaultAgent, AiVaultSession } from '../../shared/ai-vault-types'
import type { RemoteHostPlatform } from '../ssh/ssh-remote-platform'
import { joinRemotePath } from '../ssh/ssh-remote-platform'
import { parseCodexSessionContent } from './session-scanner-codex-parser'
import { parseClaudeSessionContent } from './session-scanner-primary-parsers'
import { partitionSubagentTranscriptPaths } from './session-scanner-subagent-transcripts'
import type { FileWithMtime } from './session-scanner-types'
import { remoteCodexIndexedTitleReader } from './remote-session-scanner-codex-index'
import type {
  RemoteParserOptions,
  RemoteScannerContext,
  RemoteSessionSource
} from './remote-session-scanner-types'

type RemoteContentParser = (
  file: FileWithMtime,
  content: string,
  platform: NodeJS.Platform,
  options: RemoteParserOptions,
  // Line-based parsers iterate cancellably; whole-document parsers ignore it.
  signal?: AbortSignal
) => Promise<AiVaultSession | null> | AiVaultSession | null

export function remoteSessionSources(
  remoteHome: string,
  hostPlatform: RemoteHostPlatform
): RemoteSessionSource[] {
  return [
    ...remoteCodexSources(remoteHome, hostPlatform),
    {
      ...jsonlSource(
        'claude',
        remoteHome,
        hostPlatform,
        ['.claude', 'projects'],
        parseClaudeSessionContent
      ),
      // The remote host owns the transcript disk, so the local readdir in the
      // Claude parser is skipped; the walked listing supplies the sibling
      // subagent counts instead. Partitioning also prunes the subagent
      // transcripts themselves, which would otherwise list as phantom
      // top-level sessions carrying the parent's sessionId.
      partitionSubagentTranscripts: partitionSubagentTranscriptPaths
    }
  ]
}

function source(
  agent: AiVaultAgent,
  remoteHome: string,
  hostPlatform: RemoteHostPlatform,
  segments: readonly string[],
  extensions: readonly string[],
  parseContent: RemoteContentParser,
  filePredicate?: (path: string) => boolean,
  directoryPredicate?: (name: string, depth: number) => boolean
): RemoteSessionSource {
  return {
    agent,
    rootDir: joinRemotePath(hostPlatform, remoteHome, ...segments),
    extensions,
    filePredicate,
    directoryPredicate,
    parse: (file, content, context) =>
      Promise.resolve(
        parseContent(file, content, context.hostPlatform.os, parserOptions(context), context.signal)
      )
  }
}

function jsonlSource(
  agent: AiVaultAgent,
  remoteHome: string,
  hostPlatform: RemoteHostPlatform,
  segments: readonly string[],
  parseContent: RemoteContentParser,
  filePredicate?: (path: string) => boolean
): RemoteSessionSource {
  return source(agent, remoteHome, hostPlatform, segments, ['.jsonl'], parseContent, filePredicate)
}

function remoteCodexSources(
  remoteHome: string,
  hostPlatform: RemoteHostPlatform
): RemoteSessionSource[] {
  return [
    joinRemotePath(hostPlatform, remoteHome, '.codex'),
    joinRemotePath(
      hostPlatform,
      remoteHome,
      '.local',
      'share',
      'orca',
      'codex-runtime-home',
      'home'
    )
  ].map((codexHome) => ({
    agent: 'codex',
    rootDir: joinRemotePath(hostPlatform, codexHome, 'sessions'),
    codexHome,
    extensions: ['.jsonl'],
    parse: (file, content, context) =>
      parseCodexSessionContent({
        file,
        content,
        platform: context.hostPlatform.os,
        codexHome,
        executionHostId: context.executionHostId,
        executionHostPlatform: context.hostPlatform.os,
        signal: context.signal,
        readIndexedTitle: remoteCodexIndexedTitleReader(codexHome, context)
      })
  }))
}

function parserOptions(context: RemoteScannerContext): RemoteParserOptions {
  return {
    executionHostId: context.executionHostId,
    executionHostPlatform: context.hostPlatform.os
  }
}
