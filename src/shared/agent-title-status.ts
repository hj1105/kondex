import {
  BRAILLE_SPINNER_RE,
  CLAUDE_IDLE,
  QUARTER_CIRCLE_SPINNER_RE,
  STRONG_IDLE_KEYWORDS_RE,
  STRONG_WORKING_KEYWORDS_RE,
  STRONG_WORKING_KEYWORDS_RE_GLOBAL,
  containsAgentName,
  containsAgentSpinnerGlyph,
  containsAny,
  containsQuarterCircleSpinner,
  isClaudeManagementTitle
} from './agent-title-core'
import type { AgentStatus } from './agent-title-core'
import { memoizeTitleClassification } from './terminal-title-classification-memo'

export function clearWorkingIndicators(title: string): string {
  let cleaned = title.replace(BRAILLE_SPINNER_RE, '').replace(QUARTER_CIRCLE_SPINNER_RE, '')
  if (cleaned.startsWith('. ')) {
    cleaned = cleaned.slice(2)
  }
  if (containsAgentName(cleaned)) {
    cleaned = cleaned.replace(STRONG_WORKING_KEYWORDS_RE_GLOBAL, '')
  }
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim()
  return cleaned || title
}

export function createAgentStatusTracker(
  onBecameIdle: (title: string) => void,
  onBecameWorking?: () => void,
  onAgentExited?: () => void,
  initialTitle?: string
): {
  handleTitle: (title: string) => void
  seedTitle: (title: string) => void
  restoreLastExit: () => AgentStatus | null
  reset: () => void
} {
  let lastStatus: AgentStatus | null =
    initialTitle !== undefined ? detectAgentStatusFromTitle(initialTitle) : null
  let restorableExitStatus: AgentStatus | null = null

  return {
    handleTitle(title: string): void {
      const newStatus = detectAgentStatusFromTitle(title)
      if (newStatus !== null) {
        restorableExitStatus = null
      }
      if (lastStatus === 'working' && newStatus !== null && newStatus !== 'working') {
        onBecameIdle(title)
      }
      if (lastStatus !== 'working' && newStatus === 'working') {
        onBecameWorking?.()
      }
      if (lastStatus !== null && lastStatus !== 'working' && newStatus === null) {
        restorableExitStatus = lastStatus
        lastStatus = null
        onAgentExited?.()
      }
      if (newStatus !== null) {
        lastStatus = newStatus
      }
    },
    seedTitle(title: string): void {
      lastStatus = detectAgentStatusFromTitle(title)
      restorableExitStatus = null
    },
    restoreLastExit(): AgentStatus | null {
      const restoredStatus = lastStatus === null ? restorableExitStatus : null
      if (restoredStatus !== null) {
        lastStatus = restoredStatus
      }
      restorableExitStatus = null
      return restoredStatus
    },
    reset(): void {
      lastStatus = null
      restorableExitStatus = null
    }
  }
}

export function normalizeTerminalTitle(title: string): string {
  return title
}

function computeAgentStatusFromTitle(title: string): AgentStatus | null {
  if (!title || isClaudeManagementTitle(title)) {
    return null
  }
  if (title.startsWith(`${CLAUDE_IDLE} `) || title === CLAUDE_IDLE) {
    return 'idle'
  }
  if (containsAgentSpinnerGlyph(title) || title.startsWith('. ')) {
    return 'working'
  }
  if (title.startsWith('* ')) {
    return 'idle'
  }
  if (!containsAgentName(title)) {
    return null
  }
  if (containsAny(title, ['action required', 'permission', 'waiting'])) {
    return 'permission'
  }
  if (STRONG_IDLE_KEYWORDS_RE.test(title)) {
    return 'idle'
  }
  if (STRONG_WORKING_KEYWORDS_RE.test(title)) {
    return 'working'
  }
  return 'idle'
}

export const detectAgentStatusFromTitle: (title: string) => AgentStatus | null =
  memoizeTitleClassification(computeAgentStatusFromTitle)

export function isQuarterCircleSpinnerOnlyAgentTitle(title: string | null | undefined): boolean {
  if (!title || !containsQuarterCircleSpinner(title)) {
    return false
  }
  return detectAgentStatusFromTitle(title.replace(QUARTER_CIRCLE_SPINNER_RE, '').trim()) === null
}
