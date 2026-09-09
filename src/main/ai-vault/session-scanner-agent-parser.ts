import type { AiVaultSession } from '../../shared/ai-vault-types'
import { parseClaudeSessionFile } from './session-scanner-primary-parsers'
import { parseCodexSessionFile } from './session-scanner-codex-parser'
import { parseGeminiSessionFile } from './session-scanner-gemini-parsers'
import type { SessionFileCandidate } from './session-scanner-types'

/**
 * Parse a single agent session file into an `AiVaultSession`. Routes to the
 * matching Claude, Codex, or Gemini parser based on `candidate.agent`.
 * @param candidate - The session file candidate to parse.
 * @param platform - The platform to use for resume command generation.
 * @returns The parsed `AiVaultSession`, or `null` if parsing fails.
 */
export async function parseAgentSessionFile(
  candidate: SessionFileCandidate,
  platform: NodeJS.Platform
): Promise<AiVaultSession | null> {
  switch (candidate.agent) {
    case 'claude':
      return parseClaudeSessionFile(candidate.file, platform)
    case 'codex':
      return parseCodexSessionFile(candidate.file, platform, candidate.codexHome)
    case 'gemini':
      return parseGeminiSessionFile(candidate.file, platform)
  }
}
