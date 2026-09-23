import { hasRuntimeRpcErrorCode } from '../../../../shared/runtime-rpc-error-code'

export type KontextPlanFailure =
  | 'workspaceNotFound'
  | 'workspaceAmbiguous'
  | 'workspaceMissing'
  | 'workspaceHost'

/** The sidecar's `PLANNING_USAGE_LIMIT_DIAGNOSTIC`; a contract test keeps the two equal. */
export const KONTEXT_PLAN_USAGE_LIMIT_DIAGNOSTIC = 'Planning runtime usage limit reached'

/** Names host rejections raised before the sidecar is called; anything else stays generic so host text never reaches the screen. */
export function kontextPlanFailure(error: unknown): KontextPlanFailure | null {
  if (hasRuntimeRpcErrorCode(error, 'selector_not_found')) {
    return 'workspaceNotFound'
  }
  if (hasRuntimeRpcErrorCode(error, 'selector_ambiguous')) {
    return 'workspaceAmbiguous'
  }
  const message = error instanceof Error ? error.message : ''
  // realpath runs after the selector resolved, so the registered folder itself is gone
  if (/\bENOENT\b/.test(message)) {
    return 'workspaceMissing'
  }
  if (/requires a sidecar on the file host|must have an absolute host path/.test(message)) {
    return 'workspaceHost'
  }
  return null
}

/** The sidecar's `PLANNING_INVALID_PROPOSAL_DIAGNOSTIC`; a contract test keeps the two equal. */
export const KONTEXT_PLAN_INVALID_PROPOSAL_DIAGNOSTIC = 'Planner returned an invalid proposal'

/** The sidecar's `PLANNING_STATE_INVALID_DIAGNOSTIC`; a contract test keeps the two equal. */
export const KONTEXT_PLAN_STATE_INVALID_DIAGNOSTIC = 'Planning state could not be validated'

/** Sidecar diagnostics that have a translated explanation. */
export function kontextPlanDiagnosticKey(
  diagnostic: string
): 'usageLimit' | 'invalidProposal' | 'stateInvalid' | null {
  if (diagnostic.startsWith(KONTEXT_PLAN_USAGE_LIMIT_DIAGNOSTIC)) {
    return 'usageLimit'
  }
  if (diagnostic.startsWith(KONTEXT_PLAN_STATE_INVALID_DIAGNOSTIC)) {
    return 'stateInvalid'
  }
  return diagnostic.startsWith(KONTEXT_PLAN_INVALID_PROPOSAL_DIAGNOSTIC) ? 'invalidProposal' : null
}

/** The sidecar's "(schema path: code, …)" reason; it names no model text, so it is shown untranslated. */
export function kontextInvalidProposalReason(diagnostic: string): string | null {
  if (!diagnostic.startsWith(KONTEXT_PLAN_INVALID_PROPOSAL_DIAGNOSTIC)) {
    return null
  }
  const rest = diagnostic.slice(KONTEXT_PLAN_INVALID_PROPOSAL_DIAGNOSTIC.length)
  return /^ (\(.+\)); no Task was approved\.$/.exec(rest)?.[1] ?? null
}
