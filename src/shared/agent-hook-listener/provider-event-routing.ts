import type { AgentHookSource } from '../agent-hook-relay'
import { isKnownHarnessInjectedUserTurnText } from '../harness-injected-user-turns'
import type { ToolSnapshot } from './listener-event'
import type { ExtractedPromptText } from './prompt-fields'
import { extractClaudeToolFields } from './providers/claude-tool-fields'
import { extractCodexToolFields } from './providers/codex-tool-fields'

/** The per-provider answer to "is this event a user-initiated new turn?". Exported so the
 *  observation stamp reuses it instead of minting a second list of event-name literals. */
export function isNewTurnEvent(source: AgentHookSource, eventName: unknown): boolean {
  // Why: exhaustive switch so a new AgentHookSource fails typecheck here instead of falling through to false.
  switch (source) {
    case 'claude':
      // Why: SessionStart lands an idle row (STA-3386) and must also drop stale
      // tool/prompt caches left by the pane's previous session.
      return eventName === 'SessionStart' || eventName === 'UserPromptSubmit'
    case 'codex':
      return eventName === 'SessionStart' || eventName === 'UserPromptSubmit'
  }
}

export function hasExplicitUserPrompt(
  source: AgentHookSource,
  eventName: unknown,
  extractedPrompt: ExtractedPromptText,
  resolvedPromptText: string,
  hasTranscriptPromptEvidence = false
): boolean {
  void resolvedPromptText
  void hasTranscriptPromptEvidence
  if (extractedPrompt.text.length === 0) {
    return false
  }
  // Why: harness-injected turns aren't a user submit (no prompt-sent telemetry or permission stickiness); match only KNOWN tags so a real `<my-element>` prompt still counts and survives interrupt recovery.
  if (isKnownHarnessInjectedUserTurnText(extractedPrompt.text)) {
    return false
  }
  // Why: bare `message` fields often carry permission/status copy — may update visible status prompts but aren't proof of a user submit.
  if (extractedPrompt.source === 'message') {
    return false
  }
  if (
    extractedPrompt.source === 'user_prompt' ||
    extractedPrompt.source === 'userPrompt' ||
    extractedPrompt.source === 'user_message'
  ) {
    return isNewTurnEvent(source, eventName)
  }
  return isNewTurnEvent(source, eventName)
}

export function extractToolFields(
  source: AgentHookSource,
  eventName: unknown,
  hookPayload: Record<string, unknown>
): ToolSnapshot {
  // Why: exhaustive switch so a new AgentHookSource fails typecheck here.
  switch (source) {
    case 'claude':
      return extractClaudeToolFields(eventName, hookPayload)
    case 'codex':
      return extractCodexToolFields(eventName, hookPayload)
  }
}
