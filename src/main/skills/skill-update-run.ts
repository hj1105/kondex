import {
  canonicalizeSkillUpdateNames,
  type SkillUpdateRun,
  type SkillUpdateStartResult
} from '../../shared/skill-freshness'
import type { mutateBundledAgentSkills } from './bundled-agent-skill-install'

type UpdateResult = Awaited<ReturnType<typeof mutateBundledAgentSkills>>
export type SkillUpdateRunnerDeps = {
  updateSkills: (names: string[], signal: AbortSignal) => Promise<UpdateResult>
  rescanOutdatedNames: (names: string[]) => Promise<string[]>
  now?: () => number
  onState?: (run: SkillUpdateRun) => void
}

const MAX_OUTPUT_CHARS = 32_000

export class SkillUpdateRunner {
  private run: SkillUpdateRun = { state: 'idle' }
  private controller: AbortController | null = null
  constructor(private readonly deps: SkillUpdateRunnerDeps) {}

  getState(): SkillUpdateRun {
    return this.run
  }
  private publish(next: SkillUpdateRun): void {
    this.run = next
    try {
      this.deps.onState?.(next)
    } catch {
      // Notification observers cannot participate in the update transaction.
    }
  }
  start(names: readonly string[]): SkillUpdateStartResult {
    if (this.controller) {
      return { started: false, reason: 'already-running' }
    }
    const canonicalNames = canonicalizeSkillUpdateNames(names)
    if (!canonicalNames) {
      return { started: false, reason: 'invalid-names' }
    }
    const controller = new AbortController()
    this.controller = controller
    this.publish({
      state: 'running',
      names: canonicalNames,
      startedAt: this.deps.now?.() ?? Date.now(),
      output: ''
    })
    void this.execute(canonicalNames, controller)
    return { started: true }
  }
  private async execute(names: string[], controller: AbortController): Promise<void> {
    let output = ''
    let failure: string | null = null
    let failedNames: string[] = []
    try {
      const result = await this.deps.updateSkills(names, controller.signal)
      output = [
        ...result.skills.map(
          (skill) =>
            `${skill.name}: ${skill.status}${skill.errorCategory ? ` (${skill.errorCategory})` : ''}`
        ),
        ...result.skippedSkills.map((name) => `${name}: skipped (not a managed installation)`)
      ]
        .join('\n')
        .slice(-MAX_OUTPUT_CHARS)
      failedNames = names.filter((name) => {
        const entries = result.skills.filter((skill) => skill.name === name)
        return (
          result.skippedSkills.includes(name) ||
          entries.length !== 1 ||
          !['updated', 'unchanged'].includes(entries[0].status)
        )
      })
      if (result.status !== 'complete' || failedNames.length) {
        failure = 'Some managed skills could not be updated. Local edits were preserved.'
        if (!failedNames.length) {
          failedNames = [...names]
        }
      }
    } catch (error) {
      failure = error instanceof Error ? error.message : 'Skill update failed.'
      failedNames = [...names]
    }
    // A cancelled transaction can have committed earlier skills; refresh before releasing its writer.
    try {
      const remaining = await this.deps.rescanOutdatedNames(names)
      failedNames = [
        ...new Set([...failedNames, ...remaining.filter((name) => names.includes(name))])
      ]
      if (failedNames.length && !failure) {
        failure = 'Some skills did not match the bundled version after updating.'
      }
    } catch (error) {
      failure ??= error instanceof Error ? error.message : 'Could not verify updated skills.'
      failedNames = [...names]
    }
    this.controller = null
    if (controller.signal.aborted) {
      this.publish({ state: 'idle' })
      return
    }
    const finishedAt = this.deps.now?.() ?? Date.now()
    this.publish(
      failure
        ? {
            state: 'error',
            names,
            finishedAt,
            output,
            failedNames,
            message: failure
          }
        : { state: 'success', names, finishedAt, output }
    )
  }
  cancel(): void {
    if (!this.controller || this.controller.signal.aborted) {
      return
    }
    this.controller.abort()
    // Never admit another writer until the cancelled operation and its re-scan have settled.
    if (this.run.state === 'running') {
      this.publish({ ...this.run, stopping: true })
    }
  }
  acknowledge(): void {
    if (this.run.state === 'success' || this.run.state === 'error') {
      this.publish({ state: 'idle' })
    }
  }
}
