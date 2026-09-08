import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveKontextSidecarPath } from './kontext-sidecar-path'
import { KontextSidecarService, type KontextSidecarError } from './kontext-sidecar-service'

const FIXTURE_PATH = fileURLToPath(new URL('./__fixtures__/kontext-sidecar.mjs', import.meta.url))
const temporaryRoots: string[] = []
const services: KontextSidecarService[] = []

afterEach(async () => {
  await Promise.all(services.splice(0).map((service) => service.close()))
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })))
})

describe('resolveKontextSidecarPath', () => {
  it('prefers the explicit sidecar path over the packaged resource', async () => {
    const resourcesPath = await makeTemporaryRoot()
    const packagedPath = join(resourcesPath, 'kontext', 'server.mjs')
    await mkdir(dirname(packagedPath), { recursive: true })
    await writeFile(packagedPath, '')

    const resolution = await resolveKontextSidecarPath({
      resourcesPath,
      environment: { KONDEX_KONTEXT_SIDECAR_PATH: FIXTURE_PATH }
    })

    expect(resolution).toEqual({
      status: 'configured',
      path: await realpath(FIXTURE_PATH),
      source: 'environment'
    })
  })

  it('reports a missing packaged resource as not configured', async () => {
    const resourcesPath = await makeTemporaryRoot()

    await expect(resolveKontextSidecarPath({ resourcesPath, environment: {} })).resolves.toEqual({
      status: 'not_configured',
      expectedPath: join(resourcesPath, 'kontext', 'server.mjs')
    })
  })

  it('resolves the packaged resourcesPath/kontext/server.mjs fallback', async () => {
    const resourcesPath = await makeTemporaryRoot()
    const packagedPath = join(resourcesPath, 'kontext', 'server.mjs')
    await mkdir(dirname(packagedPath), { recursive: true })
    await writeFile(packagedPath, '')

    await expect(resolveKontextSidecarPath({ resourcesPath, environment: {} })).resolves.toEqual({
      status: 'configured',
      path: await realpath(packagedPath),
      source: 'packaged'
    })
  })

  it('reports a missing explicit sidecar as unavailable', async () => {
    const resourcesPath = await makeTemporaryRoot()
    const missingPath = join(resourcesPath, 'missing.mjs')

    const resolution = await resolveKontextSidecarPath({
      resourcesPath,
      environment: { KONDEX_KONTEXT_SIDECAR_PATH: missingPath }
    })

    expect(resolution).toMatchObject({
      status: 'unavailable',
      path: missingPath,
      source: 'environment'
    })
  })
})

describe('KontextSidecarService', () => {
  it('injects its private host capability instead of accepting caller or environment overrides', async () => {
    const service = makeService(await makeTemporaryRoot())
    for (const name of [
      'kontext_list_sources',
      'kontext_create_task',
      'kontext_start_plan',
      'kontext_refine_plan',
      'kontext_inspect_plan',
      'kontext_cancel_plan',
      'kontext_approve_plan',
      'kontext_register_markdown_source',
      'kontext_register_session_source',
      'kontext_inspect_source',
      'kontext_refresh_source',
      'kontext_set_source_sharing'
    ] as const) {
      expect(await service.callTool(name, { hostToken: 'caller-controlled' })).toEqual({
        authorized: true
      })
    }
  })
  it('keeps one MCP process alive and returns structured content only', async () => {
    const userDataPath = await makeTemporaryRoot()
    const service = makeService(userDataPath)

    const first = await service.inspectRuntimes()
    const second = await service.inspectRuntimes()

    expect(first).toMatchObject({
      callCount: 1,
      dataDirectory: await realpath(join(userDataPath, 'kontext')),
      electronRunAsNode: '1',
      marker: 'from-kondex'
    })
    expect(second).toMatchObject({ callCount: 2, pid: record(first).pid })
    expect(first).not.toHaveProperty('source')
  })

  it('does not parse text content when structured content is absent', async () => {
    const service = makeService(await makeTemporaryRoot())

    await expect(service.callTool('kontext_get_schedule', {})).rejects.toMatchObject({
      name: 'KontextSidecarError',
      code: 'unavailable',
      message: 'Kontext sidecar returned no structured response for kontext_get_schedule'
    })
  })

  it('surfaces not configured distinctly from unavailable', async () => {
    const userDataPath = await makeTemporaryRoot()
    const missingResourcesPath = await makeTemporaryRoot()
    const notConfigured = new KontextSidecarService({
      userDataPath,
      resourcesPath: missingResourcesPath,
      environment: {}
    })
    const unavailable = new KontextSidecarService({
      userDataPath,
      resourcesPath: missingResourcesPath,
      environment: { KONDEX_KONTEXT_SIDECAR_PATH: join(missingResourcesPath, 'missing.mjs') }
    })
    services.push(notConfigured, unavailable)

    await expect(notConfigured.inspectRuntimes()).rejects.toMatchObject({
      code: 'not_configured'
    })
    await expect(unavailable.inspectRuntimes()).rejects.toMatchObject({ code: 'unavailable' })
  })

  it('closes idempotently and rejects later calls', async () => {
    const service = makeService(await makeTemporaryRoot())
    await service.inspectRuntimes()

    await service.close()
    await service.close()

    await expect(service.inspectRuntimes()).rejects.toEqual(
      expect.objectContaining<Partial<KontextSidecarError>>({
        name: 'KontextSidecarError',
        code: 'unavailable',
        message: 'Kontext sidecar service is closed'
      })
    )
  })
})

function makeService(userDataPath: string): KontextSidecarService {
  const service = new KontextSidecarService({
    userDataPath,
    environment: {
      ...process.env,
      KONDEX_KONTEXT_SIDECAR_PATH: FIXTURE_PATH,
      KONTEXT_PLUGIN_DATA: 'must-be-overridden',
      KONTEXT_HOST_MANAGEMENT_TOKEN: 'must-be-overridden',
      KONTEXT_SIDECAR_TEST_MARKER: 'from-kondex'
    },
    executablePath: process.execPath
  })
  services.push(service)
  return service
}

async function makeTemporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'kondex-kontext-sidecar-'))
  temporaryRoots.push(root)
  return root
}

function record(value: unknown): Record<string, unknown> {
  expect(value).toBeTypeOf('object')
  return value as Record<string, unknown>
}
