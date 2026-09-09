import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveKontextOntologyCli } from './kontext-ontology-cli'

const roots: string[] = []

function makeCheckout(withCli: boolean): { root: string; sidecar: string; cli: string } {
  const created = mkdtempSync(join(tmpdir(), 'kondex-ontology-cli-'))
  roots.push(created)
  const root = realpathSync(created)
  mkdirSync(join(root, 'plugins', 'kontext-brain'), { recursive: true })
  const sidecar = join(root, 'plugins', 'kontext-brain', 'server.mjs')
  writeFileSync(sidecar, '// sidecar')
  const cli = join(root, 'packages', 'loader', 'dist', 'ontology-cli-main.js')
  if (withCli) {
    mkdirSync(join(root, 'packages', 'loader', 'dist'), { recursive: true })
    writeFileSync(cli, '// cli')
  }
  return { root, sidecar, cli }
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

describe('resolveKontextOntologyCli', () => {
  it('prefers the single-file CLI packaged beside the sidecar, which a packaged app can run', async () => {
    const resources = realpathSync(mkdtempSync(join(tmpdir(), 'kondex-ontology-resources-')))
    roots.push(resources)
    mkdirSync(join(resources, 'kontext'))
    writeFileSync(join(resources, 'kontext', 'ontology-cli.mjs'), '// bundled cli')
    const checkout = makeCheckout(true)
    expect(
      await resolveKontextOntologyCli({
        resourcesPath: resources,
        environment: { KONDEX_KONTEXT_SIDECAR_PATH: checkout.sidecar }
      })
    ).toEqual({ status: 'configured', path: join(resources, 'kontext', 'ontology-cli.mjs') })
  })

  it('uses the bundled CLI beside a configured sidecar before the checkout build', async () => {
    const checkout = makeCheckout(true)
    const beside = join(checkout.root, 'plugins', 'kontext-brain', 'ontology-cli.mjs')
    writeFileSync(beside, '// bundled cli')
    expect(
      await resolveKontextOntologyCli({
        environment: { KONDEX_KONTEXT_SIDECAR_PATH: checkout.sidecar }
      })
    ).toEqual({ status: 'configured', path: beside })
  })

  it('finds the CLI in the same checkout as the configured sidecar', async () => {
    const { sidecar, cli } = makeCheckout(true)
    const resolution = await resolveKontextOntologyCli({
      environment: { KONDEX_KONTEXT_SIDECAR_PATH: sidecar } as NodeJS.ProcessEnv
    })
    expect(resolution).toEqual({ status: 'configured', path: cli })
  })

  it('names the build command when the checkout has no built CLI', async () => {
    const { sidecar } = makeCheckout(false)
    const resolution = await resolveKontextOntologyCli({
      environment: { KONDEX_KONTEXT_SIDECAR_PATH: sidecar } as NodeJS.ProcessEnv
    })
    expect(resolution.status).toBe('not_configured')
    // The fix is to build the package, so the message has to say that rather than
    // blame the checkout, which is present and correct.
    expect(resolution).toMatchObject({
      reason: expect.stringContaining('pnpm --filter @kontext-brain/loader build')
    })
  })

  it('reports no checkout rather than guessing a path when the sidecar is unset', async () => {
    const resolution = await resolveKontextOntologyCli({ environment: {} as NodeJS.ProcessEnv })
    expect(resolution).toEqual({
      status: 'not_configured',
      reason: 'No Kontext Brain checkout is configured for this host.'
    })
  })

  it('prefers an explicit CLI override over the sidecar-derived path', async () => {
    const { sidecar } = makeCheckout(true)
    const other = mkdtempSync(join(tmpdir(), 'kondex-ontology-override-'))
    roots.push(other)
    const override = join(other, 'custom-cli.js')
    writeFileSync(override, '// override')
    const resolution = await resolveKontextOntologyCli({
      environment: {
        KONDEX_KONTEXT_SIDECAR_PATH: sidecar,
        KONDEX_KONTEXT_ONTOLOGY_CLI: override
      } as NodeJS.ProcessEnv
    })
    expect(resolution).toEqual({ status: 'configured', path: override })
  })

  it('refuses a directory given as the CLI', async () => {
    const other = mkdtempSync(join(tmpdir(), 'kondex-ontology-dir-'))
    roots.push(other)
    const resolution = await resolveKontextOntologyCli({
      environment: { KONDEX_KONTEXT_ONTOLOGY_CLI: other } as NodeJS.ProcessEnv
    })
    expect(resolution).toMatchObject({ status: 'not_configured' })
  })
})
