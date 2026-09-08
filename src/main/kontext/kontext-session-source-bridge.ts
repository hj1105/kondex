import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { mkdir, open, realpath, rename, unlink } from 'node:fs/promises'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { join } from 'node:path'
import { z } from 'zod'
import {
  kontextSessionSourcePreviewSchema,
  type KontextSessionSourcePreview
} from '../../shared/kontext-session-source-contract'

const requestSchema = z
  .object({ requestId: z.string().uuid(), sessionId: z.string().min(1).max(4096) })
  .strict()
const MAX_REQUEST_BYTES = 32 * 1024

export class KontextSessionSourceBridge {
  private server: Server | null = null
  private starting: Promise<void> | null = null
  private closed = false
  private active = 0
  private readonly token = randomBytes(32).toString('hex')
  private readonly instanceId = randomUUID()

  constructor(
    private readonly options: {
      dataDirectory: string
      runtimeId: string
      read: (sessionId: string) => KontextSessionSourcePreview
    }
  ) {}

  start(): Promise<void> {
    if (this.closed) {
      return Promise.reject(new Error('Session source reader is closed'))
    }
    this.starting ??= this.listen().catch((error: unknown) => {
      this.starting = null
      throw error
    })
    return this.starting
  }

  async close(): Promise<void> {
    this.closed = true
    await this.starting?.catch(() => undefined)
    const server = this.server
    this.server = null
    if (server) {
      server.closeAllConnections()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  }

  private async listen(): Promise<void> {
    const server = createServer((request, response) => void this.respond(request, response))
    server.requestTimeout = 5000
    server.headersTimeout = 5000
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', () => {
        server.removeListener('error', reject)
        resolve()
      })
    })
    this.server = server
    try {
      const address = server.address()
      if (!address || typeof address === 'string') {
        throw new Error('Session source reader unavailable')
      }
      await mkdir(join(this.options.dataDirectory, 'knowledge'), { recursive: true, mode: 0o700 })
      const directory = await realpath(join(this.options.dataDirectory, 'knowledge'))
      const file = join(directory, 'native-source-reader.json')
      const temporary = `${file}.${this.instanceId}.tmp`
      const handle = await open(temporary, 'wx', 0o600)
      try {
        await handle.writeFile(
          JSON.stringify({
            schemaVersion: 1,
            runtimeId: this.options.runtimeId,
            instanceId: this.instanceId,
            endpoint: `http://127.0.0.1:${address.port}/v1/session`,
            token: this.token
          })
        )
        await handle.sync()
        await handle.close()
        await rename(temporary, file)
      } finally {
        await handle.close()
        await unlink(temporary).catch((error: unknown) => {
          if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
            throw error
          }
        })
      }
    } catch (error) {
      server.closeAllConnections()
      await new Promise<void>((resolve) => server.close(() => resolve()))
      this.server = null
      throw error
    }
  }

  private async respond(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const address = this.server?.address()
    const supplied = request.headers.authorization?.replace(/^Bearer /, '') ?? ''
    if (
      this.closed ||
      !address ||
      typeof address === 'string' ||
      request.headers.host !== `127.0.0.1:${address.port}` ||
      request.headers.origin !== undefined ||
      request.method !== 'POST' ||
      request.url !== '/v1/session' ||
      !/^[a-f0-9]{64}$/.test(supplied) ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(this.token))
    ) {
      response.writeHead(403).end()
      return
    }
    if (this.active >= 8) {
      response.writeHead(503).end()
      return
    }
    this.active++
    const deadline = setTimeout(() => request.destroy(), 5000)
    deadline.unref()
    request.setTimeout(5000, () => request.destroy())
    try {
      const chunks: Buffer[] = []
      let bytes = 0
      for await (const chunk of request) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        bytes += buffer.length
        if (bytes > MAX_REQUEST_BYTES) {
          throw new Error('Source reader request too large')
        }
        chunks.push(buffer)
      }
      const input = requestSchema.parse(
        JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)))
      )
      const source = kontextSessionSourcePreviewSchema.parse(this.options.read(input.sessionId))
      if (
        source.origin.runtimeId !== this.options.runtimeId ||
        source.origin.sessionId !== input.sessionId
      ) {
        throw new Error('Source reader identity changed')
      }
      const body = JSON.stringify({ requestId: input.requestId, source })
      if (Buffer.byteLength(body, 'utf8') > 600 * 1024) {
        throw new Error('Source reader response too large')
      }
      response
        .writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
        .end(body)
    } catch {
      if (!response.destroyed) {
        response.writeHead(503, { 'Cache-Control': 'no-store' }).end()
      }
    } finally {
      clearTimeout(deadline)
      this.active--
    }
  }
}
