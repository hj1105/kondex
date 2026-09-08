import { mkdir, realpath } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { KontextSessionSourceBridge } from './kontext-session-source-bridge'
import type { KontextSessionSourcePreview } from '../../shared/kontext-session-source-contract'
import {
  resolveKontextSidecarPath,
  type KontextSidecarPathResolution
} from './kontext-sidecar-path'

const HOST_MANAGEMENT_TOOL_NAMES = [
  'kontext_inspect_registered_schedule',
  'kontext_list_registered_schedules',
  'kontext_inspect_registered_integration',
  'kontext_integrate_registered_schedule',
  'kontext_resume_registered_schedule',
  'kontext_cancel_registered_schedule',
  'kontext_list_tasks',
  'kontext_list_sources',
  'kontext_finalize_task',
  'kontext_inspect_finalization',
  'kontext_revalidate_finalization',
  'kontext_assess_completion',
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
] as const
export const KONTEXT_TOOL_NAMES = [
  'kontext_prepare_task',
  'kontext_begin_logic',
  'kontext_authorize_write',
  'kontext_refresh_task_context',
  'kontext_check_change',
  'kontext_submit_change_bundle',
  'kontext_propose_transition',
  'kontext_inspect_runtimes',
  'kontext_inspect_task',
  ...HOST_MANAGEMENT_TOOL_NAMES,
  'kontext_schedule_logic',
  'kontext_get_schedule',
  'kontext_cancel_schedule',
  'kontext_integrate_schedule'
] as const

export type KontextToolName = (typeof KONTEXT_TOOL_NAMES)[number]
export type KontextSidecarErrorCode = 'not_configured' | 'unavailable'

export class KontextSidecarError extends Error {
  override readonly name = 'KontextSidecarError'

  constructor(
    readonly code: KontextSidecarErrorCode,
    message: string,
    readonly sidecarPath?: string,
    readonly cause?: unknown
  ) {
    super(message)
  }
}

export type KontextSidecarServiceOptions = {
  /** Electron's app.getPath('userData'); the sidecar data is always rooted below it. */
  userDataPath: string
  /** Electron's process.resourcesPath on the local execution host. */
  resourcesPath?: string
  environment?: NodeJS.ProcessEnv
  executablePath?: string
  requestTimeoutMs?: number
}

const DEFAULT_REQUEST_TIMEOUT_MS = 10 * 60_000

/**
 * Owns one local MCP process for its lifetime. Remote workspaces must construct
 * this service on the remote execution host instead of falling back to the client host.
 */
export class KontextSidecarService {
  private client: Client | null = null
  private connecting: Promise<Client> | null = null
  private closePromise: Promise<void> | null = null
  private closed = false
  private sourceReader: { runtimeId: string; bridge: KontextSessionSourceBridge } | null = null
  private readonly hostManagementToken = randomBytes(32).toString('hex')

  constructor(private readonly options: KontextSidecarServiceOptions) {}

  configureSessionSourceReader(
    runtimeId: string,
    read: (sessionId: string) => KontextSessionSourcePreview
  ): void {
    if (this.closed) {
      throw new KontextSidecarError('unavailable', 'Kontext sidecar service is closed')
    }
    if (this.sourceReader) {
      if (this.sourceReader.runtimeId !== runtimeId) {
        throw new Error('Session source runtime changed')
      }
      return
    }
    this.sourceReader = {
      runtimeId,
      bridge: new KontextSessionSourceBridge({
        dataDirectory: resolve(this.options.userDataPath, 'kontext'),
        runtimeId,
        read
      })
    }
  }

  async callTool(toolName: KontextToolName, args: Record<string, unknown> = {}): Promise<unknown> {
    const client = await this.getClient()
    await this.sourceReader?.bridge.start()
    if (this.closed) {
      throw new KontextSidecarError('unavailable', 'Kontext sidecar service is closed')
    }
    let result: Awaited<ReturnType<Client['callTool']>>
    try {
      const argumentsForHost = HOST_MANAGEMENT_TOOL_NAMES.some((name) => name === toolName)
        ? { ...args, hostToken: this.hostManagementToken }
        : args
      result = await client.callTool({ name: toolName, arguments: argumentsForHost }, undefined, {
        timeout: this.options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
        resetTimeoutOnProgress: true
      })
    } catch (error) {
      throw new KontextSidecarError(
        'unavailable',
        `Kontext sidecar could not complete ${toolName}`,
        undefined,
        error
      )
    }

    if ('isError' in result && result.isError) {
      throw new KontextSidecarError(
        'unavailable',
        `Kontext sidecar reported an error for ${toolName}`
      )
    }
    if (!('structuredContent' in result) || !isRecord(result.structuredContent)) {
      throw new KontextSidecarError(
        'unavailable',
        `Kontext sidecar returned no structured response for ${toolName}`
      )
    }
    return result.structuredContent
  }

  inspectRuntimes(): Promise<unknown> {
    return this.callTool('kontext_inspect_runtimes')
  }

  async close(): Promise<void> {
    if (this.closePromise) {
      return this.closePromise
    }
    this.closed = true
    this.closePromise = this.closeConnection()
    return this.closePromise
  }

  private async getClient(): Promise<Client> {
    if (this.closed) {
      throw new KontextSidecarError('unavailable', 'Kontext sidecar service is closed')
    }
    if (this.connecting) {
      return this.connecting
    }
    if (this.client) {
      return this.client
    }

    const attempt = this.connect()
    this.connecting = attempt
    try {
      return await attempt
    } finally {
      if (this.connecting === attempt) {
        this.connecting = null
      }
    }
  }

  private async connect(): Promise<Client> {
    const resolution = await resolveKontextSidecarPath(this.options)
    if (resolution.status !== 'configured') {
      throw resolutionError(resolution)
    }

    let dataDirectory: string
    try {
      const requestedDataDirectory = resolve(this.options.userDataPath, 'kontext')
      await mkdir(requestedDataDirectory, { recursive: true })
      dataDirectory = await realpath(requestedDataDirectory)
    } catch (error) {
      throw new KontextSidecarError(
        'unavailable',
        'Kondex could not prepare the Kontext data directory',
        resolution.path,
        error
      )
    }

    const client = new Client({ name: 'kondex', version: '1.0.0' })
    const transport = new StdioClientTransport({
      command: this.options.executablePath ?? process.execPath,
      args: [resolution.path],
      cwd: dirname(resolution.path),
      env: buildSidecarEnvironment(
        this.options.environment,
        dataDirectory,
        this.hostManagementToken
      ),
      stderr: 'inherit'
    })
    this.client = client
    client.onclose = () => {
      if (this.client === client) {
        this.client = null
      }
    }

    try {
      await client.connect(transport)
      if (this.closed) {
        await client.close()
        throw new KontextSidecarError('unavailable', 'Kontext sidecar service is closed')
      }
      return client
    } catch (error) {
      if (this.client === client) {
        this.client = null
      }
      await client.close().catch(() => undefined)
      if (error instanceof KontextSidecarError) {
        throw error
      }
      throw new KontextSidecarError(
        'unavailable',
        'Kondex could not connect to the Kontext sidecar',
        resolution.path,
        error
      )
    }
  }

  private async closeConnection(): Promise<void> {
    const connecting = this.connecting
    if (connecting) {
      await connecting.catch(() => undefined)
    }
    const client = this.client
    this.client = null
    await client?.close().catch(() => undefined)
    await this.sourceReader?.bridge.close()
  }
}

function buildSidecarEnvironment(
  environment: NodeJS.ProcessEnv | undefined,
  dataDirectory: string,
  hostManagementToken: string
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(environment ?? process.env)) {
    if (typeof value === 'string') {
      result[key] = value
    }
  }
  result.ELECTRON_RUN_AS_NODE = '1'
  result.KONTEXT_PLUGIN_DATA = dataDirectory
  result.KONTEXT_HOST_MANAGEMENT_TOKEN = hostManagementToken
  return result
}

function resolutionError(
  resolution: Exclude<KontextSidecarPathResolution, { status: 'configured' }>
) {
  if (resolution.status === 'not_configured') {
    return new KontextSidecarError(
      'not_configured',
      'Kontext sidecar is not configured; set KONDEX_KONTEXT_SIDECAR_PATH or package resources/kontext/server.mjs'
    )
  }
  return new KontextSidecarError(
    'unavailable',
    `Configured Kontext sidecar is unavailable: ${resolution.reason}`,
    resolution.path
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
