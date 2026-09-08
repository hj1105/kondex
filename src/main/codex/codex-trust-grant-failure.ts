import type { CodexTrustGrantSessionVerifyClass } from './codex-app-server-client'

export type CodexTrustGrantFallbackReason =
  | 'disabled'
  | 'no-managed-entries'
  | 'unsupported'
  | 'unsupported-cached'
  | 'verify-failed'
  | 'retry-cached'
  | 'error'

export type CodexTrustGrantVerifyClass =
  | CodexTrustGrantSessionVerifyClass
  | 'unexpected-key'
  | 'duplicate-key'
  | 'coverage'
