import type { AgentType } from '../../../../shared/agent-status-types'
import type { GlobalSettings } from '../../../../shared/global-settings-types'

export type TerminalGpuAccelerationMode = GlobalSettings['terminalGpuAcceleration']

/**
 * The resolved renderer decision for a pane. `gpuEnabled` is the content-compat
 * gate passed to `setPaneGpuRendering`; the user-setting mode gate and WebGL
 * capability/context-loss latches are still applied downstream by the pane
 * manager, so this decision never has to force WebGL on when it is unavailable.
 */
export type RendererPolicyDecision = {
  gpuEnabled: boolean
  reason: 'user-setting' | 'capability' | 'context-loss'
  confidence: 'authoritative' | 'fallback'
}

export type ResolvePaneRendererPolicyInput = {
  rawTitle: string | null
  ownerAgentType: AgentType | null | undefined
  userGpuMode: TerminalGpuAccelerationMode
  /** Set when the pane cannot obtain a WebGL context at all. */
  webglUnavailable?: boolean
  /** Set when the pane is inside GPU crash/context-loss containment. */
  inContextLossContainment?: boolean
}

/**
 * Resolves the pane renderer (WebGL vs DOM content gate) from the user GPU
 * setting and WebGL capability/context-loss state.
 *
 * Precedence: user `off` keeps the effective renderer on DOM downstream while
 * leaving the content gate open for a later mode switch; WebGL
 * unavailable/context-loss force DOM; explicit `on` keeps GPU enabled.
 */
export function resolvePaneRendererPolicy(
  input: ResolvePaneRendererPolicyInput
): RendererPolicyDecision {
  const { userGpuMode } = input

  if (userGpuMode === 'off') {
    return { gpuEnabled: true, reason: 'user-setting', confidence: 'authoritative' }
  }

  if (input.inContextLossContainment) {
    return { gpuEnabled: false, reason: 'context-loss', confidence: 'authoritative' }
  }
  if (input.webglUnavailable) {
    return { gpuEnabled: false, reason: 'capability', confidence: 'authoritative' }
  }

  if (userGpuMode === 'on') {
    return { gpuEnabled: true, reason: 'user-setting', confidence: 'authoritative' }
  }

  return { gpuEnabled: true, reason: 'capability', confidence: 'authoritative' }
}
