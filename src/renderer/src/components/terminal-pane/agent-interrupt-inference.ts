import {
  AGENT_STATUS_STALE_AFTER_MS,
  type AgentStatusEntry
} from '../../../../shared/agent-status-types'
import {
  AGENT_INTERRUPT_SETTLE_MS,
  type AgentInterruptInferenceRequest,
  type AgentInterruptInputIntent
} from '../../../../shared/agent-interrupt-intent'
import { isAskUserQuestionTool } from '../../../../shared/agent-question-answered-intent'
import { isExplicitAgentStatusFresh } from '@/lib/agent-status'

export type AgentInterruptInference = {
  observeInputIntent(
    intent: AgentInterruptInputIntent,
    entry?: AgentStatusEntry | null,
    baselineSequence?: number
  ): boolean | Promise<boolean> | undefined
  flushPending(): boolean | Promise<boolean>
  dispose(): void
}

type AgentInterruptInferenceDeps = {
  paneKey: string
  getStatusEntry: () => AgentStatusEntry | undefined
  inferInterrupt: (request: AgentInterruptInferenceRequest) => boolean | Promise<boolean> | void
  now?: () => number
  setTimer?: (callback: () => void, ms: number) => ReturnType<typeof setTimeout>
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void
}

type CapturedInterruptBaseline = {
  updatedAt: number
  stateStartedAt: number
  prompt: string
  agentType: AgentStatusEntry['agentType']
  intent: AgentInterruptInputIntent
  inputCount?: number
}

function shouldFlushInterruptImmediately(
  baseline: Pick<CapturedInterruptBaseline, 'agentType' | 'intent'>
): boolean {
  return baseline.agentType === 'codex' && baseline.intent === 'plain-escape'
}

function canInferInterrupt(entry: AgentStatusEntry, intent: AgentInterruptInputIntent): boolean {
  return (
    entry.state === 'working' ||
    (intent === 'plain-escape' &&
      entry.state === 'waiting' &&
      entry.agentType === 'claude' &&
      isAskUserQuestionTool(entry.toolName))
  )
}

export function isPlainEscapeKeyEvent(
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey' | 'repeat'>
): boolean {
  return (
    event.key === 'Escape' &&
    !event.repeat &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    !event.shiftKey
  )
}

export function isCtrlCKeyEvent(
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey' | 'repeat'>
): boolean {
  return (
    event.key.toLowerCase() === 'c' &&
    !event.repeat &&
    event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    !event.shiftKey
  )
}

export function createAgentInterruptInference({
  paneKey,
  getStatusEntry,
  inferInterrupt,
  now = () => Date.now(),
  setTimer = (callback, ms) => setTimeout(callback, ms),
  clearTimer = (timer) => clearTimeout(timer)
}: AgentInterruptInferenceDeps): AgentInterruptInference {
  let disposed = false
  let pendingTimer: ReturnType<typeof setTimeout> | null = null
  let pendingBaseline: CapturedInterruptBaseline | null = null
  let latestBaselineSequence = 0

  const clearPendingTimer = (): void => {
    if (pendingTimer !== null) {
      clearTimer(pendingTimer)
      pendingTimer = null
    }
    pendingBaseline = null
  }

  const clearPending = (): void => {
    clearPendingTimer()
  }

  const captureBaseline = (
    entry: AgentStatusEntry,
    intent: AgentInterruptInputIntent
  ): CapturedInterruptBaseline | null => {
    const agentType = entry.agentType
    if (
      !canInferInterrupt(entry, intent) ||
      !isExplicitAgentStatusFresh(entry, now(), AGENT_STATUS_STALE_AFTER_MS)
    ) {
      return null
    }
    return {
      updatedAt: entry.updatedAt,
      stateStartedAt: entry.stateStartedAt,
      prompt: entry.prompt,
      agentType,
      intent
    }
  }

  const flushPending = (): boolean | Promise<boolean> => {
    if (disposed) {
      return false
    }
    const baseline = pendingBaseline
    pendingTimer = null
    pendingBaseline = null
    if (!baseline) {
      return false
    }

    const entry = getStatusEntry()
    if (
      entry &&
      (!canInferInterrupt(entry, baseline.intent) ||
        entry.agentType !== baseline.agentType ||
        entry.prompt !== baseline.prompt ||
        entry.updatedAt !== baseline.updatedAt ||
        entry.stateStartedAt !== baseline.stateStartedAt ||
        !isExplicitAgentStatusFresh(entry, now(), AGENT_STATUS_STALE_AFTER_MS))
    ) {
      return false
    }
    if (!entry && now() - baseline.updatedAt > AGENT_STATUS_STALE_AFTER_MS) {
      return false
    }

    const result = inferInterrupt({
      paneKey,
      baselineUpdatedAt: baseline.updatedAt,
      baselineStateStartedAt: baseline.stateStartedAt,
      baselinePrompt: baseline.prompt,
      baselineAgentType: baseline.agentType,
      intent: baseline.intent,
      ...(baseline.inputCount !== undefined ? { inputCount: baseline.inputCount } : {})
    })
    return result ?? true
  }

  const flushPendingFromTimer = (): void => {
    void flushPending()
  }

  return {
    observeInputIntent(intent, capturedEntry, baselineSequence) {
      if (disposed) {
        return
      }
      if (baselineSequence !== undefined) {
        if (baselineSequence < latestBaselineSequence) {
          return
        }
        latestBaselineSequence = baselineSequence
      }
      const currentEntry = getStatusEntry()
      // Why: an older acknowledged write must not replace a newer turn's pending inference.
      if (capturedEntry !== undefined && currentEntry && currentEntry !== capturedEntry) {
        return
      }
      const entry = capturedEntry === undefined ? currentEntry : capturedEntry
      if (!entry) {
        clearPending()
        return
      }
      const baseline = captureBaseline(entry, intent)
      if (!baseline) {
        clearPending()
        return
      }
      clearPendingTimer()
      pendingBaseline = baseline
      if (shouldFlushInterruptImmediately(baseline)) {
        // Why: these interrupts can emit an idle/done hook before the settle timer,
        // overwriting the working baseline and losing the interrupted outcome.
        return flushPending()
      }
      pendingTimer = setTimer(flushPendingFromTimer, AGENT_INTERRUPT_SETTLE_MS)
      return undefined
    },
    flushPending,
    dispose() {
      disposed = true
      clearPending()
    }
  }
}
