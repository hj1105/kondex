import type {
  AiVaultAgent,
  AiVaultFirstUserPromptResult,
  AiVaultSession
} from '../../shared/ai-vault-types'
import { LOCAL_EXECUTION_HOST_ID, type ExecutionHostId } from '../../shared/execution-host'
import { wslGatedStat } from '../native-chat/wsl-transcript-fs-access'
import { parseAgentSessionFile } from './session-scanner-agent-parser'
import { withFullFirstUserPromptCapture } from './session-scanner-first-user-prompt-capture'
import type { FileWithMtime } from './session-scanner-types'

export type ReadAiVaultFirstUserPromptArgs = {
  agent: AiVaultAgent
  filePath: string
  sessionId?: string
  executionHostId?: ExecutionHostId
  codexHome?: string | null
}

export type ReadAiVaultFirstUserPromptResult = AiVaultFirstUserPromptResult

/**
 * Re-parse one session transcript under full first-prompt capture and return
 * the untruncated first real user ask for copy/reuse.
 */
export async function readAiVaultFirstUserPrompt(
  args: ReadAiVaultFirstUserPromptArgs
): Promise<ReadAiVaultFirstUserPromptResult> {
  const filePath = args.filePath.trim()
  if (!filePath || !args.agent) {
    return { prompt: null }
  }

  // Why: transcript bodies live on the session host. Remote rows are skipped
  // (same posture as listSubagentSessions); UI falls back to preview text.
  const executionHostId = args.executionHostId ?? LOCAL_EXECUTION_HOST_ID
  if (executionHostId !== LOCAL_EXECUTION_HOST_ID) {
    return { prompt: null }
  }

  // Why: partial/corrupt transcripts make parsers throw. Resolve null like every
  // other unavailable case instead of rejecting the IPC call.
  let session: AiVaultSession | null
  try {
    session = await withFullFirstUserPromptCapture(() =>
      parseSessionForFullFirstUserPrompt({
        agent: args.agent,
        filePath,
        sessionId: args.sessionId?.trim() || undefined,
        codexHome: args.codexHome ?? null
      })
    )
  } catch {
    return { prompt: null }
  }

  const prompt = session?.firstUserPrompt?.trim() || null
  return { prompt }
}

async function parseSessionForFullFirstUserPrompt(args: {
  agent: AiVaultAgent
  filePath: string
  sessionId?: string
  codexHome: string | null
}): Promise<AiVaultSession | null> {
  const file = await fileWithMtimeForPath(args.filePath)
  if (!file) {
    return null
  }

  return parseAgentSessionFile(
    {
      agent: args.agent,
      file,
      codexHome: args.codexHome
    },
    process.platform
  )
}

async function fileWithMtimeForPath(filePath: string): Promise<FileWithMtime | null> {
  try {
    // 'scan' matches the parser this feeds, so the two halves of one re-parse
    // share a lane instead of the stat jumping the live-transcript queue.
    const info = await wslGatedStat(filePath, 'scan')
    return {
      path: filePath,
      mtimeMs: info.mtimeMs,
      modifiedAt: info.mtime.toISOString(),
      sizeBytes: info.size
    }
  } catch {
    return null
  }
}
