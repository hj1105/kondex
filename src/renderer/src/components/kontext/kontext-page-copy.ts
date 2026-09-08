import { translate } from '@/i18n/i18n'

export function getKontextPageCopy() {
  return {
    notReported: translate('kondex.runtime.notReported', 'Not reported'),
    noSnapshot: translate('kondex.runtime.noSnapshot', 'No capability snapshot was returned.'),
    ready: translate('kondex.runtime.ready', 'Ready'),
    readyDetail: translate(
      'kondex.runtime.readyDetail',
      'Authenticated subscription runtime with the required isolation.'
    ),
    notInstalled: translate('kondex.runtime.notInstalled', 'Not installed'),
    cliNotFound: translate('kondex.runtime.cliNotFound', 'CLI not found.'),
    signInRequired: translate('kondex.runtime.signInRequired', 'Sign-in required'),
    authUnproven: translate(
      'kondex.runtime.authUnproven',
      'Subscription authentication was not proven.'
    ),
    billingUnverified: translate('kondex.runtime.billingUnverified', 'Billing unverified'),
    apiConsent: translate(
      'kondex.runtime.apiConsent',
      'API-billed execution is blocked until the user explicitly consents.'
    ),
    subscriptionUnproven: translate(
      'kondex.runtime.subscriptionUnproven',
      'The runtime could not prove that subscription billing will be used.'
    ),
    capabilityGap: translate('kondex.runtime.capabilityGap', 'Capability gap'),
    capabilityGapDetail: translate(
      'kondex.runtime.capabilityGapDetail',
      'Structured output or workspace isolation is unavailable.'
    ),
    noCliPath: translate('kondex.runtime.noCliPath', 'No CLI path'),
    unknown: translate('kondex.runtime.unknown', 'Unknown'),
    structured: translate('kondex.runtime.structured', 'Structured output'),
    noStructuredOutput: translate('kondex.runtime.noStructuredOutput', 'No structured output'),
    sandboxed: translate('kondex.runtime.sandboxed', 'Workspace isolated'),
    noSandboxProof: translate('kondex.runtime.noSandboxProof', 'Isolation unverified'),
    subscriptionRuntimes: translate('kondex.runtime.subscriptionRuntimes', 'Subscription runtimes'),
    eligibilityDescription: translate(
      'kondex.runtime.eligibilityDescription',
      'Only authenticated, isolated subscription paths meet the scheduling requirements.'
    ),
    inspecting: translate('kondex.runtime.inspecting', 'Inspecting the selected runtime…'),
    notConfigured: translate('kondex.runtime.notConfigured', 'Kontext sidecar is not configured'),
    unavailable: translate('kondex.runtime.unavailable', 'Kontext sidecar is unavailable'),
    retry: translate('kondex.runtime.retry', 'Retry'),
    receipt: translate('kondex.runtime.receipt', 'Context Receipt'),
    receiptDetail: translate('kondex.runtime.receiptDetail', 'exact symbol + current evidence'),
    bundle: translate('kondex.runtime.bundle', 'Change Bundle'),
    bundleDetail: translate('kondex.runtime.bundleDetail', 'worker output bound to revision'),
    verification: translate('kondex.runtime.verification', 'Targeted Verification'),
    verificationDetail: translate(
      'kondex.runtime.verificationDetail',
      'proof for the changed behavior'
    ),
    workItems: translate('kondex.runtime.workItems', 'Logic Work Items'),
    symbolBoundary: translate(
      'kondex.runtime.symbolBoundary',
      'One behavior-bearing symbol per work item.'
    ),
    taskListNotConnected: translate(
      'kondex.runtime.taskListNotConnected',
      'Task list not connected'
    ),
    readinessOnly: translate(
      'kondex.runtime.readinessOnly',
      'This page only inspects runtime readiness. Task publishing and worker scheduling are not connected here yet.'
    ),
    executionReadiness: translate('kondex.runtime.executionReadiness', 'Execution readiness'),
    title: translate('kondex.runtime.title', 'Evidence-backed coding runtime'),
    description: translate(
      'kondex.runtime.description',
      'Kontext provides planning, context receipts, scheduling, and verification. Kondex hosts the editor, terminals, diffs, and agent sessions.'
    ),
    evidenceChain: translate('kondex.runtime.evidenceChain', 'Planned evidence workflow'),
    integrationBoundary: translate(
      'kondex.runtime.integrationBoundary',
      'Plan and register personal-context Tasks, schedule logic workers, and inspect integration evidence. Managed context selection and final Task completion are not connected yet.'
    ),
    subscription: translate('kondex.runtime.subscription', 'Subscription'),
    api: translate('kondex.runtime.api', 'API billing')
  }
}
