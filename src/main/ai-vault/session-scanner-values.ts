import { wslGatedReadFile } from '../native-chat/wsl-transcript-fs-access'
import { WslTranscriptFsError } from '../native-chat/wsl-transcript-fs-gate'
import { asRecord } from './session-scanner-record-value'

export { asRecord }

export function timestampMs(value: unknown): number {
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : Number.NaN
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return Number.NaN
  }
  return value > 1_000_000_000_000 ? value : value * 1000
}

export function parseJsonObject(line: string): Record<string, unknown> | null {
  if (!line.trim()) {
    return null
  }
  try {
    const parsed = JSON.parse(line) as unknown
    return asRecord(parsed)
  } catch {
    return null
  }
}

export function extractString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function extractModel(value: unknown): string | null {
  const record = asRecord(value)
  if (!record) {
    return null
  }
  return (
    extractString(record.model) ||
    extractString(record.model_name) ||
    extractString(asRecord(record.metadata)?.model) ||
    extractString(asRecord(record.info)?.model) ||
    null
  )
}

export {
  extractContentText,
  extractMessageText,
  extractPreviewContentText,
  normalizePreviewText,
  normalizeTitleText,
  sliceAtCodeUnitLimit
} from './session-scanner-text-normalization'
export {
  extractFullFirstUserPromptText,
  normalizeFullFirstUserPromptText,
  shouldCaptureFullFirstUserPrompt
} from './session-scanner-first-user-prompt'

export function extractGitBranch(value: unknown): string | null {
  const git = asRecord(value)
  if (!git) {
    return null
  }
  return extractString(git.branch) || extractString(git.current_branch)
}

export async function readJsonObjectIfExists(
  filePath: string
): Promise<Record<string, unknown> | null> {
  try {
    return asRecord(JSON.parse(await wslGatedReadFile(filePath, 'utf-8', 'scan')) as unknown)
  } catch (error) {
    // A missing or malformed file is genuinely "no enrichment", but a gate
    // refusal must reach `parseSessionCandidate` as an issue — degrading it to
    // null caches the un-enriched session under an unchanged mtime, and the
    // non-resumable agents that use this never re-read it.
    if (error instanceof WslTranscriptFsError) {
      throw error
    }
    return null
  }
}

export function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

export function firstString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = extractString(record[key])
    if (value) {
      return value
    }
  }
  return null
}

export function extractTrustedFolder(value: unknown): string | null {
  const message = extractString(value)
  if (!message) {
    return null
  }
  return message.match(/^Folder (.+) has been added to trusted folders\.$/)?.[1] ?? null
}

export function timeObjectValue(value: unknown, key: string): string | null {
  const record = asRecord(value)
  if (!record) {
    return null
  }
  const rawValue = record[key]
  if (typeof rawValue === 'string') {
    return rawValue
  }
  const parsed = timestampMs(rawValue)
  if (!Number.isFinite(parsed)) {
    return null
  }
  return new Date(parsed).toISOString()
}

export function clampPositiveInteger(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export {
  addCodexUsage,
  claudeUsageTotal,
  normalizeCodexUsage,
  numberValue,
  subtractCodexUsage,
  tokenTotal
} from './session-scanner-token-values'
