import { isNewTurnEvent } from '../../../shared/agent-hook-listener/provider-event-routing'
import type { AgentHookEventPayload } from '../../../shared/agent-hook-listener/listener-event'
import type {
  AgentStatusObservation,
  AgentStatusObservationOrigin
} from '../../../shared/agent-status-observation'
import type { EnrichedAgentHookEventPayload } from './server-types'
import { AgentHookServerStatusDisposition } from './server-status-disposition'

/** Bounds the retained observation clock; eviction only degrades a replay to `now`. */
const MAX_REMEMBERED_EVIDENCE_OBSERVATIONS = 1024

export abstract class AgentHookServerStatusApplication extends AgentHookServerStatusDisposition {
  protected attachStatusTiming(
    payload: AgentHookEventPayload,
    now = Date.now()
  ): EnrichedAgentHookEventPayload {
    const previous = this.state.lastStatusByPaneKey.get(payload.paneKey) as
      | EnrichedAgentHookEventPayload
      | undefined
    const stateStartedAt =
      previous && previous.payload.state === payload.payload.state ? previous.stateStartedAt : now
    // Why: `stateStartedAt` tracks the current state, while `receivedAt` tracks every arrival.
    return {
      ...payload,
      receivedAt: now,
      evidenceObservedAt: this.resolveEvidenceObservedAt(payload, previous, now),
      stateStartedAt
    }
  }

  /**
   * A replay restates evidence already observed; it is not a new observation. Keeping
   * `receivedAt` at `now` preserves delivery order (the connection-clear watermark and the
   * renderer's four `<` drops all depend on it), while this clock records when the evidence
   * was actually seen — so the staleness window measures age, not reconnect count.
   * Without a remembered time the honest answer is `now`, which is today's behaviour.
   */
  private resolveEvidenceObservedAt(
    payload: AgentHookEventPayload,
    previous: EnrichedAgentHookEventPayload | undefined,
    now: number
  ): number {
    const remembered =
      previous?.evidenceObservedAt ?? this.evidenceObservedAtByPaneKey.get(payload.paneKey)
    const observedAt = payload.isReplay === true && remembered !== undefined ? remembered : now
    this.evidenceObservedAtByPaneKey.delete(payload.paneKey)
    this.evidenceObservedAtByPaneKey.set(payload.paneKey, observedAt)
    while (this.evidenceObservedAtByPaneKey.size > MAX_REMEMBERED_EVIDENCE_OBSERVATIONS) {
      const oldest = this.evidenceObservedAtByPaneKey.keys().next().value
      if (typeof oldest !== 'string') {
        break
      }
      this.evidenceObservedAtByPaneKey.delete(oldest)
    }
    return observedAt
  }

  /** Stamp who observed this event, in what order, on main's clock. Nothing reads it yet
   *  (STA-4293) — it is stamped here because every main-side ingress funnels through
   *  applyNormalizedStatus, so no origin can silently arrive untagged. */
  protected stampObservation(
    payload: AgentHookEventPayload,
    origin: AgentStatusObservationOrigin,
    observedAt: number
  ): AgentStatusObservation {
    return this.observations.observe(payload.paneKey, {
      origin,
      observedAt,
      // Why: reuse the listener's own per-provider classifier; a second list of raw event-name
      // literals here would strand the providers whose boundary event is named anything else.
      boundary:
        payload.source !== undefined && isNewTurnEvent(payload.source, payload.hookEventName),
      // Identity refreshes only update resume metadata, even when replayed. A replay
      // or OSC repaint otherwise restates existing state rather than a new transition.
      kind: payload.providerSessionOnly
        ? 'identity-only'
        : payload.isReplay === true || origin === 'osc'
          ? 'snapshot'
          : 'transition'
    })
  }
}
