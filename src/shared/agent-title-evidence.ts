import {
  CLAUDE_IDLE,
  containsAgentSpinnerGlyph,
  isClaudeIdentityFrameSegment,
  isClaudeManagementTitle,
  titleHasAgentName
} from './agent-title-core'
import { stripLeadingAgentTitleDecorationOrEmpty } from './agent-title-decoration'
import { SYNTHETIC_AGENT_TITLE_PROFILES } from './synthetic-agent-title'
import type { TuiAgent } from './tui-agent'

export type AgentTitleEvidenceReason =
  | 'anchored'
  | 'vendor-marker'
  | 'conflicting-anchored-names'
  | 'conflicting-vendor-markers'
  | 'free-text-only'
  | 'no-evidence'

export type AgentTitleEvidence = {
  readonly vendorMarkers: readonly TuiAgent[]
  readonly anchoredNames: readonly TuiAgent[]
  readonly freeTextNames: readonly TuiAgent[]
  readonly agent: TuiAgent | null
  readonly reason: AgentTitleEvidenceReason
}

const NAME_TOKENS: readonly (readonly [string, TuiAgent])[] = [
  ['claude', 'claude'],
  ['codex', 'codex']
]
const DISPLAY_LABELS: readonly (readonly [string, TuiAgent])[] = [
  ['claude code', 'claude'],
  ['claude', 'claude'],
  ['codex', 'codex']
]
const OWNER_SUFFIX_RE = /\s-\s+([A-Za-z][\w-]*)\s*$/
const WINDOWS_LAUNCHER_SUFFIX_RE = /\.(?:exe|cmd|bat|ps1)$/i
const WRAPPER_SEPARATOR = ' | '
const MAX_WRAPPER_EVIDENCE_SEGMENTS = 8

function getEvidenceTitleSegments(title: string): string[] {
  const segments = [title]
  let separatorIndex = title.lastIndexOf(WRAPPER_SEPARATOR)
  while (separatorIndex >= 0 && segments.length < MAX_WRAPPER_EVIDENCE_SEGMENTS) {
    const wrapped = title.slice(separatorIndex + WRAPPER_SEPARATOR.length).trim()
    if (wrapped && !segments.includes(wrapped)) {
      segments.push(wrapped)
    }
    // lastIndexOf clamps negative positions to zero, so a leading separator must terminate.
    separatorIndex =
      separatorIndex === 0 ? -1 : title.lastIndexOf(WRAPPER_SEPARATOR, separatorIndex - 1)
  }
  return segments
}

function namesIn(text: string): TuiAgent[] {
  return NAME_TOKENS.filter(([token]) => titleHasAgentName(text, token)).map(([, agent]) => agent)
}

function stripBareNameDecoration(text: string): string {
  return text
    .trim()
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .replace(/[^\p{L}\p{N}]+$/u, '')
}

function agentForBareName(text: string): TuiAgent | null {
  const trimmed = text.trim()
  if (!trimmed || /[\\/]/.test(trimmed)) {
    return null
  }
  const stripped = stripBareNameDecoration(trimmed)
  const label = DISPLAY_LABELS.find(([candidate]) => candidate === stripped.toLowerCase())
  if (label) {
    return label[1]
  }
  const bareToken = stripped.replace(WINDOWS_LAUNCHER_SUFFIX_RE, '')
  const names = namesIn(bareToken)
  return names.length === 1 && /^[\p{L}\p{N}]+$/u.test(bareToken) ? names[0] : null
}

function agentForWholeTitle(text: string): TuiAgent | null {
  if (/[\\/]/.test(text)) {
    return null
  }
  const stripped = stripBareNameDecoration(text)
  const label = DISPLAY_LABELS.find(([candidate]) => candidate === stripped.toLowerCase())
  if (label) {
    return label[1]
  }
  return WINDOWS_LAUNCHER_SUFFIX_RE.test(stripped) ? agentForBareName(stripped) : null
}

function agentForSyntheticTitle(text: string): TuiAgent | null {
  const profile = SYNTHETIC_AGENT_TITLE_PROFILES.codex
  const normalized = stripLeadingAgentTitleDecorationOrEmpty(text).trim().toLowerCase()
  if (
    normalized === profile.permissionLabel.toLowerCase() ||
    normalized === profile.idleLabel.toLowerCase() ||
    (containsAgentSpinnerGlyph(text) && normalized === profile.workingLabel.toLowerCase())
  ) {
    return 'codex'
  }
  return null
}

function collectVendorMarkers(segments: readonly string[]): TuiAgent[] {
  return segments.some(
    (segment) =>
      segment.startsWith(`${CLAUDE_IDLE} `) ||
      segment === CLAUDE_IDLE ||
      segment.startsWith('. ') ||
      segment.startsWith('* ')
  )
    ? ['claude']
    : []
}

function collectAnchoredNames(segments: readonly string[]): TuiAgent[] {
  const anchored = new Set<TuiAgent>()
  for (const segment of segments) {
    const suffix = OWNER_SUFFIX_RE.exec(segment)
    const suffixAgent = suffix ? agentForBareName(suffix[1]) : null
    if (suffixAgent) {
      anchored.add(suffixAgent)
    }
    const withoutClaudeSigil = segment.startsWith(`${CLAUDE_IDLE} `)
      ? segment.slice(CLAUDE_IDLE.length)
      : segment
    const bare = agentForWholeTitle(withoutClaudeSigil)
    if (bare) {
      anchored.add(bare)
    }
    const synthetic = agentForSyntheticTitle(segment)
    if (synthetic) {
      anchored.add(synthetic)
    }
    if (isClaudeIdentityFrameSegment(segment)) {
      anchored.add('claude')
    }
  }
  return [...anchored]
}

export function collectAgentTitleEvidence(title: string): AgentTitleEvidence {
  const empty = { vendorMarkers: [], anchoredNames: [], freeTextNames: [] } as const
  if (!title.trim() || isClaudeManagementTitle(title)) {
    return { ...empty, agent: null, reason: 'no-evidence' }
  }

  const segments = getEvidenceTitleSegments(title)
  const vendorMarkers = collectVendorMarkers(segments)
  const anchoredNames = collectAnchoredNames(segments)
  const anchoredSet = new Set(anchoredNames)
  const freeTextNames = namesIn(title).filter((agent) => !anchoredSet.has(agent))
  const evidence = { vendorMarkers, anchoredNames, freeTextNames } as const

  if (anchoredNames.length === 1) {
    return { ...evidence, agent: anchoredNames[0], reason: 'anchored' }
  }
  if (anchoredNames.length > 1) {
    return { ...evidence, agent: null, reason: 'conflicting-anchored-names' }
  }
  if (vendorMarkers.length > 1) {
    return { ...evidence, agent: null, reason: 'conflicting-vendor-markers' }
  }
  if (vendorMarkers.length === 1) {
    return { ...evidence, agent: vendorMarkers[0], reason: 'vendor-marker' }
  }
  return {
    ...evidence,
    agent: null,
    reason: freeTextNames.length > 0 ? 'free-text-only' : 'no-evidence'
  }
}
