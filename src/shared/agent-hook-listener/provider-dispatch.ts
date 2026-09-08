import type { ParsedAgentStatusPayload } from '../agent-status-types'
import type { AgentHookSource } from '../agent-hook-relay'
import type { HookListenerState } from './listener-state'
import type { ExtractedPromptText } from './prompt-fields'
import { normalizeClaudeEvent } from './providers/claude-events'
import { normalizeCodexEvent } from './providers/codex-events'

export type ProviderDispatchResult = {
  payload: ParsedAgentStatusPayload | null
  resolvedPromptText: string
  promptInteractionKey?: string
  hasTranscriptPromptEvidence: boolean
}

/** Exhaustive provider routing with provider-specific transcript locality and attribution. */
export function normalizeProviderEvent(input: {
  state: HookListenerState
  source: AgentHookSource
  eventName: unknown
  promptText: string
  paneKey: string
  hookPayload: Record<string, unknown>
  envelope: Record<string, unknown>
  extractedPrompt: ExtractedPromptText
}): ProviderDispatchResult {
  const { state, source, eventName, promptText, paneKey, hookPayload } = input
  let payload: ParsedAgentStatusPayload | null = null

  switch (source) {
    case 'claude':
      payload = normalizeClaudeEvent(state, eventName, promptText, paneKey, hookPayload)
      break
    case 'codex':
      payload = normalizeCodexEvent(state, eventName, promptText, paneKey, hookPayload)
      break
  }

  return {
    payload,
    resolvedPromptText: promptText,
    hasTranscriptPromptEvidence: false
  }
}
