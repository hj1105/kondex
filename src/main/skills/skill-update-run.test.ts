import { describe, expect, it, vi } from 'vitest'
import { SkillUpdateRunner, type SkillUpdateRunnerDeps } from './skill-update-run'

function successful(names = ['kondex-cli']) {
  return {
    status: 'complete' as const,
    skills: names.map((name) => ({
      name,
      skillId: name,
      digest: 'digest',
      status: 'unchanged' as const,
      placements: []
    })),
    skippedSkills: []
  }
}
function fixture(overrides: Partial<SkillUpdateRunnerDeps> = {}) {
  const updateSkills = vi.fn().mockResolvedValue(successful())
  const rescanOutdatedNames = vi.fn().mockResolvedValue([])
  const onState = vi.fn()
  const runner = new SkillUpdateRunner({
    updateSkills,
    rescanOutdatedNames,
    onState,
    now: () => 42,
    ...overrides
  })
  return { runner, updateSkills, rescanOutdatedNames, onState }
}
async function settled(runner: SkillUpdateRunner) {
  await vi.waitFor(() => expect(runner.getState().state).not.toBe('running'))
  return runner.getState()
}
describe('native managed skill update runner', () => {
  it('passes deduplicated explicit names and an abort signal, then verifies disk before success', async () => {
    const test = fixture()
    expect(test.runner.start(['kondex-cli', 'kondex-cli'])).toEqual({ started: true })
    expect(test.updateSkills).toHaveBeenCalledWith(['kondex-cli'], expect.any(AbortSignal))
    expect(await settled(test.runner)).toMatchObject({
      state: 'success',
      names: ['kondex-cli'],
      output: 'kondex-cli: unchanged'
    })
    expect(test.rescanOutdatedNames).toHaveBeenCalledWith(['kondex-cli'])
  })
  it.each(
    [[], ['../bad'], ['kondex-cli;echo nope'], [''], ['kondex cli']].map((names) => ({ names }))
  )('refuses invalid names: $names', ({ names }) => {
    const test = fixture()
    expect(test.runner.start(names)).toEqual({ started: false, reason: 'invalid-names' })
    expect(test.updateSkills).not.toHaveBeenCalled()
  })
  it('reports skipped/unowned skills rather than treating a no-op as success', async () => {
    const test = fixture({
      updateSkills: async () => ({ status: 'complete', skills: [], skippedSkills: ['kondex-cli'] })
    })
    test.runner.start(['kondex-cli'])
    expect(await settled(test.runner)).toMatchObject({
      state: 'error',
      failedNames: ['kondex-cli']
    })
  })
  it.each(['kept-local', 'failed', 'cancelled', 'installed'] as const)(
    'rejects an unexpected update result: %s',
    async (status) => {
      const test = fixture({
        updateSkills: async () => ({
          ...successful(),
          skills: [{ ...successful().skills[0], status }]
        })
      })
      test.runner.start(['kondex-cli'])
      expect(await settled(test.runner)).toMatchObject({
        state: 'error',
        failedNames: ['kondex-cli']
      })
    }
  )
  it('requires exactly one result per selected skill', async () => {
    const result = successful()
    result.skills.push(result.skills[0])
    const test = fixture({ updateSkills: async () => result })
    test.runner.start(['kondex-cli'])
    expect(await settled(test.runner)).toMatchObject({
      state: 'error',
      failedNames: ['kondex-cli']
    })
  })
  it('does not let a successful scan erase a native mutation failure', async () => {
    const test = fixture({
      updateSkills: async () => {
        throw new Error('Write denied')
      }
    })
    test.runner.start(['kondex-cli'])
    expect(await settled(test.runner)).toMatchObject({ state: 'error', message: 'Write denied' })
    expect(test.rescanOutdatedNames).toHaveBeenCalledOnce()
  })
  it('requires the post-update scan to confirm every selected skill', async () => {
    const test = fixture({ rescanOutdatedNames: async () => ['kondex-cli'] })
    test.runner.start(['kondex-cli'])
    expect(await settled(test.runner)).toMatchObject({
      state: 'error',
      failedNames: ['kondex-cli']
    })
  })
  it('fails closed when verification is unavailable', async () => {
    const test = fixture({
      rescanOutdatedNames: async () => {
        throw new Error('Scan unavailable')
      }
    })
    test.runner.start(['kondex-cli'])
    expect(await settled(test.runner)).toMatchObject({
      state: 'error',
      message: 'Scan unavailable',
      failedNames: ['kondex-cli']
    })
  })
  it('holds the writer through cancellation, transaction completion, and the final scan', async () => {
    let finishUpdate!: (value: ReturnType<typeof successful>) => void
    let finishScan!: (value: string[]) => void
    let signal!: AbortSignal
    const test = fixture({
      updateSkills: (_names, value) => {
        signal = value
        return new Promise((resolve) => {
          finishUpdate = resolve
        })
      },
      rescanOutdatedNames: () =>
        new Promise((resolve) => {
          finishScan = resolve
        })
    })
    test.runner.start(['kondex-cli'])
    test.runner.cancel()
    test.runner.cancel()
    expect(signal.aborted).toBe(true)
    expect(test.runner.getState()).toMatchObject({ state: 'running', stopping: true })
    expect(test.runner.start(['kondex-cli'])).toEqual({ started: false, reason: 'already-running' })
    finishUpdate(successful())
    await vi.waitFor(() => expect(finishScan).toBeTypeOf('function'))
    expect(test.runner.start(['kondex-cli'])).toEqual({ started: false, reason: 'already-running' })
    test.runner.acknowledge()
    expect(test.runner.getState().state).toBe('running')
    finishScan([])
    expect(await settled(test.runner)).toEqual({ state: 'idle' })
    expect(test.runner.start(['kondex-cli'])).toEqual({ started: true })
    finishUpdate(successful())
    await Promise.resolve()
    finishScan([])
    await settled(test.runner)
  })
  it('can acknowledge a settled result and ignores notification observer failures', async () => {
    const test = fixture({
      onState: () => {
        throw new Error('Window closed')
      }
    })
    test.runner.start(['kondex-cli'])
    expect(await settled(test.runner)).toMatchObject({ state: 'success' })
    test.runner.acknowledge()
    expect(test.runner.getState()).toEqual({ state: 'idle' })
  })
})
