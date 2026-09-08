// Local diagnostic review-file collection tests.

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { _internalsForTests, collectBundle, generateBundleId } from './bundle'

let dir: string
let traceFile: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'orca-bundle-'))
  traceFile = join(dir, 'main.trace.ndjson')
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function makeNDJSON(records: unknown[]): string {
  return `${records.map((r) => JSON.stringify(r)).join('\n')}\n`
}

function makeSpan(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const now = BigInt(Date.now()) * 1_000_000n
  return {
    type: 'effect-span',
    name: 'test',
    traceId: 'a'.repeat(32),
    spanId: 'b'.repeat(16),
    kind: 'internal',
    startTimeUnixNano: String(now - 1_000_000_000n),
    endTimeUnixNano: String(now),
    durationMs: 1,
    attributes: {},
    events: [],
    exit: { _tag: 'Success' },
    ...overrides
  }
}

describe('bundle — submission ID', () => {
  it('is base64url, 22 chars (128 bits)', () => {
    const id = generateBundleId()
    expect(id).toMatch(/^[A-Za-z0-9_-]{22}$/)
  })
  it('is unique across many calls', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 100; i++) {
      ids.add(generateBundleId())
    }
    expect(ids.size).toBe(100)
  })
})

describe('bundle — collection', () => {
  it('emits a header line with bundle_id, app_version, and platform', () => {
    writeFileSync(traceFile, makeNDJSON([makeSpan()]))
    const bundle = collectBundle({
      traceFilePath: traceFile,
      maxFiles: 10,
      appVersion: '1.2.3',
      platform: 'darwin',
      arch: 'arm64',
      osRelease: '24.0.0'
    })
    const header = JSON.parse(bundle.payload.split('\n').find(Boolean) ?? '')
    expect(header.type).toBe('bundle-header')
    expect(header.bundle_id).toBe(bundle.bundleId)
    expect(header.app_version).toBe('1.2.3')
    expect(header.platform).toBe('darwin')
    expect(header.arch).toBe('arm64')
    expect(header.schema_version).toBe(1)
  })

  it('NEVER carries install_id in the header (Issue 8)', () => {
    writeFileSync(traceFile, makeNDJSON([makeSpan()]))
    const bundle = collectBundle({
      traceFilePath: traceFile,
      maxFiles: 10,
      appVersion: '1.0',
      platform: 'darwin',
      arch: 'arm64',
      osRelease: '24'
    })
    const header = JSON.parse(bundle.payload.split('\n')[0])
    expect(header).not.toHaveProperty('install_id')
    expect(header).not.toHaveProperty('installId')
    expect(header).not.toHaveProperty('distinct_id')
  })

  it('reads spans from the rotated family', () => {
    writeFileSync(traceFile, makeNDJSON([makeSpan({ name: 'a' })]))
    writeFileSync(`${traceFile}.1`, makeNDJSON([makeSpan({ name: 'b' })]))
    const bundle = collectBundle({
      traceFilePath: traceFile,
      maxFiles: 10,
      appVersion: '1',
      platform: 'darwin',
      arch: 'arm64',
      osRelease: '24'
    })
    expect(bundle.spanCount).toBe(2)
  })

  it('drops spans older than the lookback window', () => {
    const oldNanos = BigInt(Date.now() - 60 * 60 * 1000) * 1_000_000n // 1h ago
    writeFileSync(
      traceFile,
      makeNDJSON([
        makeSpan({ name: 'recent' }),
        makeSpan({
          name: 'old',
          startTimeUnixNano: String(oldNanos - 1n),
          endTimeUnixNano: String(oldNanos)
        })
      ])
    )
    const bundle = collectBundle({
      traceFilePath: traceFile,
      maxFiles: 10,
      lookbackMinutes: 30,
      appVersion: '1',
      platform: 'darwin',
      arch: 'arm64',
      osRelease: '24'
    })
    // Header + recent only.
    expect(bundle.spanCount).toBe(1)
    expect(bundle.payload).toContain('"name":"recent"')
    expect(bundle.payload).not.toContain('"name":"old"')
  })

  it('merges the daemon lifecycle log, bounded by the same lookback', () => {
    const daemonFile = join(dir, 'daemon.log')
    writeFileSync(traceFile, makeNDJSON([makeSpan({ name: 'recent' })]))
    writeFileSync(
      daemonFile,
      makeNDJSON([
        { src: 'daemon', ts: new Date().toISOString(), pid: 1, event: 'startup' },
        {
          src: 'daemon',
          // 1h ago — outside the 30m window, must be dropped.
          ts: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          pid: 1,
          event: 'session-exited'
        }
      ])
    )
    const bundle = collectBundle({
      traceFilePath: traceFile,
      maxFiles: 10,
      daemonLogFilePath: daemonFile,
      daemonLogMaxFiles: 3,
      lookbackMinutes: 30,
      appVersion: '1',
      platform: 'darwin',
      arch: 'arm64',
      osRelease: '24'
    })
    expect(bundle.payload).toContain('"event":"startup"')
    expect(bundle.payload).toContain('"name":"recent"')
    expect(bundle.payload).not.toContain('"event":"session-exited"')
  })

  it('collects no daemon log lines when no daemon log path is given', () => {
    writeFileSync(traceFile, makeNDJSON([makeSpan({ name: 'recent' })]))
    const bundle = collectBundle({
      traceFilePath: traceFile,
      maxFiles: 10,
      appVersion: '1',
      platform: 'darwin',
      arch: 'arm64',
      osRelease: '24'
    })
    expect(bundle.payload).not.toContain('"src":"daemon"')
  })

  it('runs the redactor on the merged payload (belt-and-suspenders)', () => {
    // Simulate a sink-write bug that leaked a secret through. The bundle
    // pass should still strip it.
    const span = makeSpan({
      attributes: {
        // raw secret embedded in serialized form — bypass the API surface.
        leaked: `sk-ant-api03-${'a'.repeat(50)}`
      }
    })
    writeFileSync(traceFile, makeNDJSON([span]))
    const bundle = collectBundle({
      traceFilePath: traceFile,
      maxFiles: 10,
      appVersion: '1',
      platform: 'darwin',
      arch: 'arm64',
      osRelease: '24'
    })
    expect(bundle.payload).not.toContain('sk-ant-api03-aaaaa')
    expect(bundle.payload).toContain('[redacted:anthropic-key]')
  })

  it('uses server-mode structured redaction for nested auth and identity keys', () => {
    writeFileSync(
      traceFile,
      makeNDJSON([
        makeSpan({
          attributes: {
            install_id: 'legacy-install-id',
            request: {
              headers: {
                authorization: 'Bearer plain-secret',
                cookie: 'sid=plain-secret',
                keep: 'ok'
              }
            }
          }
        })
      ])
    )
    const bundle = collectBundle({
      traceFilePath: traceFile,
      maxFiles: 10,
      appVersion: '1',
      platform: 'darwin',
      arch: 'arm64',
      osRelease: '24'
    })
    expect(bundle.payload).not.toContain('legacy-install-id')
    expect(bundle.payload).not.toContain('plain-secret')
    expect(bundle.payload).not.toContain('authorization')
    expect(bundle.payload).not.toContain('cookie')
    expect(bundle.payload).toContain('"keep":"ok"')
  })

  it('does not append a span that would push the review file over its size cap', () => {
    const giantSpan = makeSpan({
      attributes: {
        message: 'x'.repeat(_internalsForTests.MAX_BUNDLE_BYTES)
      }
    })
    writeFileSync(traceFile, makeNDJSON([giantSpan]))
    const bundle = collectBundle({
      traceFilePath: traceFile,
      maxFiles: 10,
      appVersion: '1',
      platform: 'darwin',
      arch: 'arm64',
      osRelease: '24'
    })
    expect(bundle.bytes).toBeLessThanOrEqual(_internalsForTests.MAX_BUNDLE_BYTES)
    expect(bundle.spanCount).toBe(0)
  })

  it('keeps the newest spans when the bundle size cap truncates a file', () => {
    const oldSpan = makeSpan({
      name: 'oldest',
      attributes: { message: 'x'.repeat(_internalsForTests.MAX_BUNDLE_BYTES) }
    })
    const newSpan = makeSpan({ name: 'newest', attributes: { message: 'recent crash' } })
    writeFileSync(traceFile, makeNDJSON([oldSpan, newSpan]))
    const bundle = collectBundle({
      traceFilePath: traceFile,
      maxFiles: 10,
      appVersion: '1',
      platform: 'darwin',
      arch: 'arm64',
      osRelease: '24'
    })
    expect(bundle.payload).toContain('"name":"newest"')
    expect(bundle.payload).not.toContain('"name":"oldest"')
  })

  it('skips individually oversized recent spans and keeps smaller recent context', () => {
    const tooLargeSpan = makeSpan({
      name: 'oversized',
      attributes: { message: 'x'.repeat(_internalsForTests.MAX_BUNDLE_BYTES) }
    })
    const usefulSpan = makeSpan({
      name: 'useful',
      attributes: { message: 'still useful' }
    })
    writeFileSync(traceFile, makeNDJSON([usefulSpan, tooLargeSpan]))
    const bundle = collectBundle({
      traceFilePath: traceFile,
      maxFiles: 10,
      appVersion: '1',
      platform: 'darwin',
      arch: 'arm64',
      osRelease: '24'
    })
    expect(bundle.payload).toContain('"name":"useful"')
    expect(bundle.payload).not.toContain('"name":"oversized"')
  })

  it('skips oversized middle spans after accepting newer context', () => {
    const olderUseful = makeSpan({ name: 'older-useful', attributes: { message: 'older context' } })
    const oversizedMiddle = makeSpan({
      name: 'oversized-middle',
      attributes: { message: 'x'.repeat(_internalsForTests.MAX_BUNDLE_BYTES) }
    })
    const newestUseful = makeSpan({ name: 'newest-useful', attributes: { message: 'new context' } })
    writeFileSync(traceFile, makeNDJSON([olderUseful, oversizedMiddle, newestUseful]))
    const bundle = collectBundle({
      traceFilePath: traceFile,
      maxFiles: 10,
      appVersion: '1',
      platform: 'darwin',
      arch: 'arm64',
      osRelease: '24'
    })
    expect(bundle.payload).toContain('"name":"newest-useful"')
    expect(bundle.payload).toContain('"name":"older-useful"')
    expect(bundle.payload).not.toContain('"name":"oversized-middle"')
  })

  it('skips malformed (non-JSON) lines without throwing', () => {
    writeFileSync(traceFile, [JSON.stringify(makeSpan()), 'not json', ''].join('\n'))
    expect(() =>
      collectBundle({
        traceFilePath: traceFile,
        maxFiles: 10,
        appVersion: '1',
        platform: 'darwin',
        arch: 'arm64',
        osRelease: '24'
      })
    ).not.toThrow()
  })

  it('skips valid JSON lines that are not span objects without throwing', () => {
    writeFileSync(
      traceFile,
      [JSON.stringify(makeSpan({ name: 'valid' })), 'null', '"string"', '42', '[1]', ''].join('\n')
    )
    const bundle = collectBundle({
      traceFilePath: traceFile,
      maxFiles: 10,
      appVersion: '1',
      platform: 'darwin',
      arch: 'arm64',
      osRelease: '24'
    })

    expect(bundle.spanCount).toBe(1)
    expect(bundle.payload).toContain('"name":"valid"')
  })
})
