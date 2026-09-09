import { titleHasAgentName, titleHasAnyLegacyAgentName } from './agent-name-token-match'
import { stripLeadingAgentTitleDecorationOrEmpty } from './agent-title-decoration'
import { memoizeTitleClassification } from './terminal-title-classification-memo'
import { getWrapperTitleSegments } from './terminal-title-wrapper-segments'

export { titleHasAgentName }

export type AgentStatus = 'working' | 'permission' | 'idle'

export const CLAUDE_IDLE = '\u2733'
const CLAUDE_COMMAND_RE = String.raw`(?:.*[\\/])?claude(?:\.(?:exe|cmd|bat|ps1))?`
export const CLAUDE_MANAGEMENT_TITLE_RE = new RegExp(
  String.raw`^\s*(?:"${CLAUDE_COMMAND_RE}"|'${CLAUDE_COMMAND_RE}'|${CLAUDE_COMMAND_RE})\s+agents\s*$`,
  'i'
)

const STRONG_IDLE_KEYWORDS = ['ready', 'idle', 'done'] as const
const STRONG_WORKING_KEYWORDS = ['working', 'thinking', 'running'] as const

export const STRONG_IDLE_KEYWORDS_RE = new RegExp(
  `(?<![\\w./\\\\-])(${STRONG_IDLE_KEYWORDS.join('|')})(?![\\w\\-])`,
  'i'
)

export const STRONG_WORKING_KEYWORDS_RE = new RegExp(
  `(?<![\\w./\\\\-])(${STRONG_WORKING_KEYWORDS.join('|')})(?![\\w\\-])`,
  'i'
)

export const STRONG_WORKING_KEYWORDS_RE_GLOBAL = new RegExp(STRONG_WORKING_KEYWORDS_RE.source, 'gi')

// eslint-disable-next-line no-control-regex -- intentional unicode range
export const BRAILLE_SPINNER_RE = /[\u2800-\u28ff]/g
export const QUARTER_CIRCLE_SPINNER_RE = /[\u25d0-\u25d3]/g

export function containsBrailleSpinner(title: string): boolean {
  for (const char of title) {
    const codePoint = char.codePointAt(0)
    if (codePoint !== undefined && codePoint >= 0x2800 && codePoint <= 0x28ff) {
      return true
    }
  }
  return false
}

export function containsQuarterCircleSpinner(title: string): boolean {
  for (const char of title) {
    const codePoint = char.codePointAt(0)
    if (codePoint !== undefined && codePoint >= 0x25d0 && codePoint <= 0x25d3) {
      return true
    }
  }
  return false
}

export function containsAgentSpinnerGlyph(title: string): boolean {
  return containsBrailleSpinner(title) || containsQuarterCircleSpinner(title)
}

export function containsLegacyAgentName(title: string): boolean {
  return titleHasAnyLegacyAgentName(title)
}

export function containsAgentName(title: string): boolean {
  return containsLegacyAgentName(title)
}

export function containsAny(title: string, words: readonly string[]): boolean {
  const lower = title.toLowerCase()
  return words.some((word) => lower.includes(word))
}

export function isClaudeManagementTitle(title: string): boolean {
  return CLAUDE_MANAGEMENT_TITLE_RE.test(title)
}

const CLAUDE_IDENTITY_FRAME_RE =
  /^claude(?: code)?(?:\s+(?:ready|idle|done|working|thinking|running))?(?:\s*-\s*action required)?$/

export function isClaudeIdentityFrameSegment(title: string): boolean {
  return CLAUDE_IDENTITY_FRAME_RE.test(
    stripLeadingAgentTitleDecorationOrEmpty(title).trim().toLowerCase()
  )
}

export function isClaudeIdentityFrameTitle(title: string): boolean {
  return getWrapperTitleSegments(title).some(isClaudeIdentityFrameSegment)
}

function computeIsClaudeAgent(title: string): boolean {
  if (!title || isClaudeManagementTitle(title)) {
    return false
  }
  if (
    title.startsWith(`${CLAUDE_IDLE} `) ||
    title === CLAUDE_IDLE ||
    title.startsWith('. ') ||
    title.startsWith('* ')
  ) {
    return true
  }
  if (containsAgentSpinnerGlyph(title)) {
    return !titleHasAgentName(title, 'codex')
  }
  const trimmed = title.trimStart()
  return trimmed.toLowerCase().startsWith('claude') && titleHasAgentName(trimmed, 'claude')
}

export const isClaudeAgent: (title: string) => boolean =
  memoizeTitleClassification(computeIsClaudeAgent)

const CURSOR_NATIVE_TITLE_LOWER = 'cursor agent'

/**
 * Kondex launches only its subscription runtimes, but a Kondex terminal can host
 * any CLI — including Cursor, which treats injected PTY text as editable prompt
 * content. Recognising its titles is what stops an automated Enter from
 * submitting on the user's behalf there.
 *
 * Why not a name token: `cursor` is an ordinary editor noun that other agents
 * type into their own task summaries. Cursor's identifying titles are a closed
 * set, so match that vocabulary instead.
 */
export function isCursorAgentTitle(title: string | null | undefined): boolean {
  if (typeof title !== 'string') {
    return false
  }
  const trimmed = title.trim()
  const lower = trimmed.toLowerCase()
  if (
    lower === CURSOR_NATIVE_TITLE_LOWER ||
    lower === 'cursor ready' ||
    lower === 'cursor - action required'
  ) {
    return true
  }
  // Only the controlled synthetic Cursor spinner title counts as identity.
  return /^[\u2800-\u28ff] Cursor Agent$/u.test(trimmed)
}
