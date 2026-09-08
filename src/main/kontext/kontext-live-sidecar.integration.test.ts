import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { kontextRuntimeDoctorReportSchema } from '../../shared/kontext-runtime-contract'
import { KontextSidecarService } from './kontext-sidecar-service'

const sidecarPath = process.env.KONDEX_KONTEXT_SIDECAR_PATH?.trim()
const liveSuite = sidecarPath ? describe : describe.skip
let userDataPath = ''
let service: KontextSidecarService | null = null

liveSuite('Kontext live sidecar', () => {
  beforeAll(async () => {
    userDataPath = await mkdtemp(join(tmpdir(), 'kondex-live-kontext-'))
    service = new KontextSidecarService({
      userDataPath,
      environment: { ...process.env, KONDEX_KONTEXT_SIDECAR_PATH: sidecarPath },
      executablePath: process.execPath
    })
  })

  afterAll(async () => {
    await service?.close()
    if (userDataPath) {
      await rm(userDataPath, { recursive: true })
    }
  })

  it('accepts the real runtime doctor structured response', async () => {
    const result = await service?.inspectRuntimes()
    const report = kontextRuntimeDoctorReportSchema.parse(result)

    expect(report.capabilities.map((entry) => entry.provider).sort()).toEqual(['claude', 'codex'])
  })
})
