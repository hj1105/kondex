import { translate } from '@/i18n/i18n'

export function getKontextPlanningCopy() {
  return {
    refine: translate('kondex.planning.refine', 'Request a revised draft'),
    feedback: translate('kondex.planning.feedback', 'What should this draft change?'),
    parentPlan: translate('kondex.planning.parentPlan', 'Parent draft and exact digest'),
    refinementScope: translate(
      'kondex.planning.refinementScope',
      'Keep the original draft and create a separate proposal from this feedback. Changed code or context requires a new plan. This does not amend an approved Task.'
    ),
    refinementConsent: translate(
      'kondex.planning.refinementConsent',
      'Use the parent draft’s subscription to read this feedback, proposal, current code and permitted sources. Generate a new draft without approving it or starting implementation.'
    ),
    provider: translate('kondex.planning.provider', 'Planning runtime'),
    recover: translate('kondex.planning.recover', 'Recover original planning request'),
    title: translate('kondex.planning.title', 'Plan a new task'),
    intro: translate(
      'kondex.planning.intro',
      'Describe the goal. The main coordinator proposes symbol-scoped work; you review it before a Task is registered.'
    ),
    goal: translate('kondex.planning.goal', 'What should change?'),
    workspace: translate('kondex.planning.workspace', 'Coding workspace path or selector'),
    sources: translate('kondex.planning.sources', 'Required source Resource IDs (one per line)'),
    scope: translate(
      'kondex.planning.scope',
      'Personal context with approved local rules. Uncommitted, new Git and folder workspaces use a private baseline of tracked and non-ignored files; originals stay unchanged. Register sources and grant model access above first.'
    ),
    consent: translate(
      'kondex.planning.consent',
      'Use my selected subscription to read this code and the permitted sources to generate a plan. Do not start implementation.'
    ),
    start: translate('kondex.planning.start', 'Generate plan'),
    inspect: translate('kondex.planning.inspect', 'Read plan status'),
    cancel: translate('kondex.planning.cancel', 'Request cancellation'),
    newPlan: translate('kondex.planning.newPlan', 'New plan'),
    saved: translate('kondex.planning.saved', 'Saved planning requests'),
    unknown: translate(
      'kondex.planning.unknown',
      'Outcome not confirmed. Read the saved request on its owning runtime; no automatic retry was made.'
    ),
    failed: translate(
      'kondex.planning.failed',
      'The operation was not confirmed. Check the workspace, source permissions and runtime; read the plan before retrying.'
    ),
    storage: translate(
      'kondex.planning.storage',
      'Saved plan recovery is unavailable. Generation is disabled to preserve existing requests.'
    ),
    ownerChanged: translate(
      'kondex.planning.ownerChanged',
      'Runtime pairing changed. Reload before continuing.'
    ),
    planning: translate('kondex.planning.planning', 'Generating a proposal…'),
    review: translate('kondex.planning.review', 'Awaiting your review'),
    unverifiable: translate(
      'kondex.planning.unverifiable',
      'Execution is unverifiable. This does not mean the planner stopped.'
    ),
    approved: translate(
      'kondex.planning.approved',
      'Task registered; implementation has not started'
    ),
    approval: translate(
      'kondex.planning.approval',
      'I approve this exact task contract, symbol plan, paths, dependencies and verifiers. Register it without starting implementation.'
    ),
    approve: translate('kondex.planning.approve', 'Approve and register Task'),
    open: translate('kondex.planning.open', 'Load Task for execution'),
    busy: translate('kondex.planning.busy', 'Contacting the owning runtime…'),
    nonGoals: translate('kondex.planning.nonGoals', 'Non-goals'),
    dependencies: translate('kondex.planning.dependencies', 'Dependencies'),
    verifiers: translate('kondex.planning.verifiers', 'Verifiers'),
    risk: translate('kondex.planning.risk', 'Risk'),
    targets: translate('kondex.planning.targets', 'Targets')
  }
}
