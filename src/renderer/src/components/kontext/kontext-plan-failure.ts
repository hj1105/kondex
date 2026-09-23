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

/** Sidecar diagnostics that have a translated explanation. */
export function kontextPlanDiagnosticKey(diagnostic: string): 'usageLimit' | null {
  return diagnostic.startsWith(KONTEXT_PLAN_USAGE_LIMIT_DIAGNOSTIC) ? 'usageLimit' : null
}
