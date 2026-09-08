import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

const projectDir = resolve(import.meta.dirname, '../..')
const e2eWorkflow = parse(readFileSync(join(projectDir, '.github/workflows/e2e.yml'), 'utf8'))

describe('E2E workflow contract', () => {
  it('keeps detached E2E identifiable and manually dispatchable by ref', () => {
    const refInput = e2eWorkflow.on.workflow_dispatch.inputs.ref

    expect(e2eWorkflow['run-name']).toBe('E2E ${{ inputs.ref || github.ref }}')
    expect(refInput.type).toBe('string')
    expect(refInput.required).toBe(false)
  })

  it('overlaps the relay bundle with the Electron build', () => {
    const buildStep = e2eWorkflow.jobs.build.steps.find((step) => step.name === 'Build E2E outputs')

    expect(buildStep.run).toContain('pnpm run build:relay &')
    expect(buildStep.run).toContain('relay_pid=$!')
    expect(buildStep.run).toContain('wait "$relay_pid"')
    expect(buildStep.run).toContain('pnpm run build:web-from-renderer')
  })

  it('primes the Electron native cache before every E2E consumer', () => {
    const primer = e2eWorkflow.jobs['prepare-native-cache']
    expect(primer.steps).toBeDefined()
    expect(
      primer.steps.find((step) => step.uses === './.github/actions/install-node-dependencies').with
    ).toEqual({
      'native-runtime': 'electron'
    })
    for (const jobName of ['e2e', 'changed-e2e', 'ssh-docker-watcher-isolation']) {
      expect(e2eWorkflow.jobs[jobName].needs, jobName).toEqual(['build', 'prepare-native-cache'])
    }
  })

  it('includes the paired-runtime web client in the shared E2E build artifact', () => {
    const buildStep = e2eWorkflow.jobs.build.steps.find((step) => step.name === 'Build E2E outputs')

    expect(buildStep.run).toContain('electron-vite build --mode e2e')
    expect(buildStep.env.VITE_EXPOSE_STORE).toBe('true')
    expect(buildStep.run).toContain('pnpm run build:web-from-renderer')
    expect(buildStep.run).toContain('pnpm run build:relay')
  })

  it('hands the built relay artifact to every E2E run command', () => {
    const uploadStep = e2eWorkflow.jobs.build.steps.find(
      (step) => step.name === 'Upload E2E build output'
    )

    expect(uploadStep.with.name).toBe('e2e-build-out')
    expect(uploadStep.with.path).toBe('out/')

    for (const [jobName, runStepName] of [
      ['e2e', 'Run E2E tests (${{ matrix.shard_name }})'],
      ['changed-e2e', 'Run changed E2E specs']
    ]) {
      const job = e2eWorkflow.jobs[jobName]
      const downloadStep = job.steps.find((step) => step.name === 'Download E2E build output')
      const runStep = job.steps.find((step) => step.name === runStepName)

      expect(job.needs).toEqual(['build', 'prepare-native-cache'])
      expect(downloadStep.with.name).toBe('e2e-build-out')
      expect(downloadStep.with.path).toBe('out/')
      expect(runStep.run).toContain('ORCA_RELAY_PATH="$GITHUB_WORKSPACE/out/relay"')
    }
  })
})
