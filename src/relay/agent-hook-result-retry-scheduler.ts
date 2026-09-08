// Poll Codex transcript children after hook events so nested subagent status stays current.
import { hasCodexTranscriptSubagents } from '../shared/agent-hook-listener/providers/codex-state'
import { normalizeHookPayload } from '../shared/agent-hook-listener'
import type { AgentHookEventPayload } from '../shared/agent-hook-listener/listener-event'
import type { HookListenerState } from '../shared/agent-hook-listener/listener-state'
import type { AgentHookSource } from '../shared/agent-hook-relay'
import { CodexSubagentPollScheduler } from '../shared/codex-subagent-poll-scheduler'

const CODEX_SUBAGENT_POLL_MS = 1_000

type CodexSubagentPoll = {
  source: AgentHookSource
  body: unknown
  original: AgentHookEventPayload
  env?: string
  version?: string
}

export type AgentHookResultRetryHost = {
  state: HookListenerState
  env: string
  /** Why: must be read live — a retry armed before stop() must not resurrect on a downed server. */
  isListening: () => boolean
  applyEvent: (
    event: AgentHookEventPayload,
    source: AgentHookSource,
    env?: string,
    version?: string
  ) => void
}

export class AgentHookResultRetryScheduler {
  private codexSubagentPollScheduler: CodexSubagentPollScheduler<CodexSubagentPoll>
  private host: AgentHookResultRetryHost

  constructor(host: AgentHookResultRetryHost) {
    this.host = host
    this.codexSubagentPollScheduler = new CodexSubagentPollScheduler(
      CODEX_SUBAGENT_POLL_MS,
      (paneKey, poll) => this.runCodexSubagentPoll(paneKey, poll)
    )
  }

  clearAll(): void {
    this.codexSubagentPollScheduler.clearAll()
  }

  clearCodexSubagentPoll(paneKey: string): void {
    this.codexSubagentPollScheduler.clear(paneKey)
  }

  scheduleCodexSubagentPoll(
    source: AgentHookSource,
    body: unknown,
    original: AgentHookEventPayload,
    env?: string,
    version?: string
  ): void {
    // Why: a nested non-codex CLI inherits ORCA_PANE_KEY, so clearing here would silently end a live codex poll.
    if (source !== 'codex') {
      return
    }
    this.codexSubagentPollScheduler.clear(original.paneKey)
    if (!hasCodexTranscriptSubagents(this.host.state, original.paneKey)) {
      return
    }
    this.codexSubagentPollScheduler.schedule(original.paneKey, {
      source,
      body,
      original,
      env,
      version
    })
  }

  private runCodexSubagentPoll(paneKey: string, poll: CodexSubagentPoll): void {
    const { source, body, original, env, version } = poll
    // Keep the identity check at callback time: a newer event supersedes this
    // payload even when its pane still has transcript children.
    if (
      paneKey !== original.paneKey ||
      !this.host.isListening() ||
      this.host.state.lastStatusByPaneKey.get(original.paneKey) !== original
    ) {
      return
    }
    const event = normalizeHookPayload(this.host.state, source, body, this.host.env)
    if (!event) {
      return
    }
    const subagentsChanged =
      JSON.stringify(event.payload.subagents) !== JSON.stringify(original.payload.subagents)
    const next = subagentsChanged ? event : original
    if (subagentsChanged) {
      this.host.applyEvent(event, source, env, version)
    }
    this.scheduleCodexSubagentPoll(source, body, next, env, version)
  }
}
