import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import type { SkillBundleInstallRequest } from '../../shared/skill-bundle-install-contract'
import {
  SKILL_BUNDLE_INSTALL_CAPABILITY,
  SKILL_INSTALL_PROVIDERS_CAPABILITY,
  SKILL_UPLOAD_CAPABILITY
} from '../../shared/skill-install-capability'
import { withBundledAgentSkillArchive } from './bundled-agent-skill-archive'
import { installSkillBundleOnSshHost } from './skill-bundle-ssh-relay-service'
import { transferSkillPackageToSshHost } from './skill-ssh-package-transfer'

describe('bundled archive transfer to SSH', () => {
  it('uploads exact bundled bytes before install, without forwarding a client path or downloading', async () => {
    const uploaded: Buffer[] = []
    const fetcher = vi.fn()
    await withBundledAgentSkillArchive(['kondex-cli'], async (bundle) => {
      const request: SkillBundleInstallRequest = {
        operationId: 'bundled-transfer',
        package: {
          packageId: bundle.manifest.packageId,
          versionId: bundle.manifest.versionId,
          bundleDigest: bundle.manifest.bundleDigest,
          archiveSha256: bundle.archiveSha256,
          compressedBytes: bundle.compressedBytes
        },
        selectedSkillIds: ['kondex-cli'],
        ingress: { kind: 'local-file', path: bundle.archivePath },
        destination: { scope: 'global', executionTarget: { kind: 'host' } },
        providers: ['codex'],
        conflictDecisions: []
      }
      const client = vi.fn(async (method: string, value: unknown) => {
        const payload = value as {
          offset: number
          bytesBase64: string
          request: SkillBundleInstallRequest
        }
        expect(JSON.stringify(payload)).not.toContain(bundle.archivePath)
        switch (method) {
          case 'relay.status':
            return {
              capabilities: [
                SKILL_BUNDLE_INSTALL_CAPABILITY,
                SKILL_INSTALL_PROVIDERS_CAPABILITY,
                SKILL_UPLOAD_CAPABILITY
              ]
            }
          case 'skills.beginUpload':
            return { uploadId: 'upload-1', chunkBytes: 128, acknowledgedOffset: 0 }
          case 'skills.uploadChunk': {
            expect(payload.offset).toBe(Buffer.concat(uploaded).length)
            uploaded.push(Buffer.from(payload.bytesBase64, 'base64'))
            return { acknowledgedOffset: Buffer.concat(uploaded).length }
          }
          case 'skills.commitUpload':
            expect(createHash('sha256').update(Buffer.concat(uploaded)).digest('hex')).toBe(
              bundle.archiveSha256
            )
            return { uploadId: 'upload-1' }
          case 'skills.installBundle':
            expect(payload.request.ingress).toEqual({ kind: 'staged-upload', uploadId: 'upload-1' })
            expect(payload.request.providers).toEqual(['codex'])
            return {
              operationId: request.operationId,
              ...request.package,
              status: 'complete',
              skills: []
            }
          case 'skills.cancelUpload':
            return { cancelled: true }
          default:
            throw new Error(`Unexpected RPC: ${method}`)
        }
      })
      const result = await installSkillBundleOnSshHost({
        provider: { requestHostRpc: client } as never,
        userDataPath: '/unused-state',
        request,
        requireHttps: true,
        trustedArchivePath: bundle.archivePath,
        fetcher
      })
      expect(result.status).toBe('complete')
      expect(Buffer.concat(uploaded)).toEqual(await readFile(bundle.archivePath))
      expect(
        client.mock.calls.map(([method]) => method).indexOf('skills.commitUpload')
      ).toBeLessThan(client.mock.calls.map(([method]) => method).indexOf('skills.installBundle'))
      expect(client.mock.calls.at(-1)?.[0]).toBe('skills.cancelUpload')
      expect((await stat(bundle.archivePath)).size).toBe(bundle.compressedBytes)
    })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it.each([undefined, '/different-file', 'relative-file'])(
    'rejects an untrusted/mismatched local source %s before uploading',
    async (trustedArchivePath) => {
      const client = vi.fn()
      await expect(
        transferSkillPackageToSshHost(client, {
          request: {
            operationId: 'bad',
            package: { compressedBytes: 1 },
            ingress: { kind: 'local-file', path: '/owned-file' }
          } as never,
          userDataPath: '/unused-state',
          requireHttps: true,
          trustedArchivePath
        })
      ).rejects.toThrow(/skill-install-ssh-.*ingress-invalid/)
      expect(client).not.toHaveBeenCalled()
    }
  )
})
