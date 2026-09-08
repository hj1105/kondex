import { normalizeCompatibleAgentTitleForOwner } from '../../../../shared/agent-title-owner'
import type { AgentType } from '../../../../shared/agent-status-types'
import {
  resolvePaneRendererPolicy,
  type RendererPolicyDecision,
  type TerminalGpuAccelerationMode
} from './terminal-renderer-policy'

/** Preserves observed title text; legacy ownership arguments remain compatible. */
export function resolvePaneDisplayTitle(
  title: string,
  ownerAgentType: AgentType | null | undefined,
  ownerIsLaunch = false
): string {
  return normalizeCompatibleAgentTitleForOwner(title, ownerAgentType, { ownerIsLaunch })
}

/**
 * The resolved decision for one OSC title frame: a single owner-aware display
 * label plus the renderer policy, so `updateTabTitle`, `setRuntimePaneTitle`,
 * task-completion tracking, and the GPU gate all consume one interpretation.
 */
export type PaneTitleDecision = {
  displayTitle: string
  rawTitle: string
  rendererPolicy: RendererPolicyDecision
}

export type ResolvePaneTitleDecisionInput = {
  /** Normalized title from the transport (may already be display-shaped). */
  normalizedTitle: string
  rawTitle: string
  /** Owner used for the display label — may include sticky/tab-scoped launch
   *  identity, which is correct for the visible label. */
  displayOwnerAgentType: AgentType | null | undefined
  /** True when displayOwnerAgentType is user-selected launch ownership. */
  displayOwnerIsLaunch?: boolean
  /** Pane-scoped identity retained for callers; renderer policy no longer depends on agent names. */
  rendererOwnerAgentType: AgentType | null | undefined
  userGpuMode: TerminalGpuAccelerationMode
  webglUnavailable?: boolean
  inContextLossContainment?: boolean
}

export function resolvePaneTitleDecision(input: ResolvePaneTitleDecisionInput): PaneTitleDecision {
  const displayTitle = resolvePaneDisplayTitle(
    input.normalizedTitle,
    input.displayOwnerAgentType,
    input.displayOwnerIsLaunch === true
  )
  const rendererPolicy = resolvePaneRendererPolicy({
    rawTitle: input.rawTitle,
    ownerAgentType: input.rendererOwnerAgentType,
    userGpuMode: input.userGpuMode,
    webglUnavailable: input.webglUnavailable,
    inContextLossContainment: input.inContextLossContainment
  })
  return { displayTitle, rawTitle: input.rawTitle, rendererPolicy }
}
