import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { scanWebSocketServerBinds } from './websocket-server-bind-scan'

function scanSource(source) {
  const root = mkdtempSync(join(tmpdir(), 'kondex-websocket-scan-'))
  try {
    mkdirSync(join(root, 'src'))
    writeFileSync(join(root, 'src', 'server.ts'), source)
    return scanWebSocketServerBinds(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

describe('WebSocket bind scanner coverage', () => {
  it.each([
    ["import { WebSocketServer } from 'ws'", 'WebSocketServer'],
    ["import { WebSocketServer as Wss } from 'ws'", 'Wss'],
    ["import { Server as Wss } from 'ws'", 'Wss'],
    ["import * as ws from 'ws'", 'ws.WebSocketServer']
  ])('detects safe, wildcard and attached servers through %s', (declaration, name) => {
    const scan = scanSource(
      `${declaration}\n` +
        `new ${name}({ port: 0, host: '127.0.0.1' })\n` +
        `new ${name}({ port: 0 })\n` +
        `new ${name}({ noServer: true })\n`
    )
    expect(scan.filesScanned).toBe(1)
    expect(scan.constructions).toBe(3)
    expect(scan.loopbackBound).toEqual([{ path: 'src/server.ts', line: 2 }])
    expect(scan.wildcardBound).toEqual([{ path: 'src/server.ts', line: 3 }])
    expect(scan.attached).toEqual([{ path: 'src/server.ts', line: 4 }])
    expect(scan.opaque).toEqual([])
  })

  it('reports unreadable options instead of silently classifying them as safe', () => {
    const scan = scanSource("import { WebSocketServer } from 'ws'\nnew WebSocketServer(options)\n")
    expect(scan.constructions).toBe(1)
    expect(scan.opaque).toHaveLength(1)
    expect(scan.opaque[0]).toMatchObject({ path: 'src/server.ts', line: 2 })
    expect(scan.loopbackBound).toEqual([])
    expect(scan.attached).toEqual([])
  })
})
