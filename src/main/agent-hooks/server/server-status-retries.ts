import { hasCodexTranscriptSubagents } from '../../../shared/agent-hook-listener/providers/codex-state'
import { normalizeHookPayload } from '../../../shared/agent-hook-listener'
import type { AgentHookSource } from '../../../shared/agent-hook-relay'
import { CodexSubagentPollScheduler } from '../../../shared/codex-subagent-poll-scheduler'
import type { EnrichedAgentHookEventPayload } from './server-types'
import { CODEX_SUBAGENT_POLL_MS } from './server-constants'
import { AgentHookServerStatusUpdate } from './server-status-update'

type CodexSubagentPoll = {
  source: AgentHookSource
  body: unknown
  original: EnrichedAgentHookEventPayload
}

export abstract class AgentHookServerStatusRetries extends AgentHookServerStatusUpdate {
  private readonly codexSubagentPollScheduler = new CodexSubagentPollScheduler<CodexSubagentPoll>(
    CODEX_SUBAGENT_POLL_MS,
    (paneKey, poll) => this.runCodexSubagentPoll(paneKey, poll)
  )

  protected clearAllCodexSubagentPolls(): void {
    this.codexSubagentPollScheduler.clearAll()
  }

  protected clearCodexSubagentPoll(paneKey: string): void {
    this.codexSubagentPollScheduler.clear(paneKey)
  }

  protected scheduleCodexSubagentPoll(
    source: AgentHookSource,
    body: unknown,
    original: EnrichedAgentHookEventPayload
  ): void {
    // Why: a nested non-codex CLI inherits ORCA_PANE_KEY, so clearing here would silently end a live codex poll.
    if (source !== 'codex') {
      return
    }
    this.codexSubagentPollScheduler.clear(original.paneKey)
    if (!hasCodexTranscriptSubagents(this.state, original.paneKey)) {
      return
    }
    this.codexSubagentPollScheduler.schedule(original.paneKey, { source, body, original })
  }

  private runCodexSubagentPoll(paneKey: string, poll: CodexSubagentPoll): void {
    const { source, body, original } = poll
    // Keep the identity check at callback time: a newer event supersedes this
    // payload even when its pane still has transcript children.
    if (
      paneKey !== original.paneKey ||
      !this.server ||
      this.state.lastStatusByPaneKey.get(original.paneKey) !== original
    ) {
      return
    }
    const normalized = normalizeHookPayload(this.state, source, body, this.env)
    if (!normalized) {
      return
    }
    const subagentsChanged =
      JSON.stringify(normalized.payload.subagents) !== JSON.stringify(original.payload.subagents)
    const next = subagentsChanged ? this.applyNormalizedStatus(normalized) : original
    this.scheduleCodexSubagentPoll(source, body, next)
  }
}
