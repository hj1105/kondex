import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { join } from 'node:path'
import {
  FAKE_USER_DATA_PATH,
  FAKE_APP_OUT_MAIN_PATH,
  FAKE_DAEMON_ENTRY_PATH
} from './daemon-init-test-harness'

const {
  getAppPathMock,
  probeSocketExistsMock,
  netConnectMock,
  forkMock,
  checkDaemonHealthMock,
  getMacDaemonSystemResolverHealthMock,
  getDaemonLaunchIdentityMock,
  killStaleDaemonMock,
  daemonClientMock,
  spawnerInstances,
  adapterInstances,
  importFresh,
  installDefaultNetConnectStub,
  moduleFactories
} = await vi.hoisted(async () =>
  (await import('./daemon-init-test-harness')).createDaemonInitMocks()
)

vi.mock('fs', () => moduleFactories.fs())
vi.mock('child_process', async (importOriginal) =>
  moduleFactories.childProcess(await importOriginal<Record<string, unknown>>())
)
vi.mock('net', () => moduleFactories.net())
vi.mock('./daemon-health', () => moduleFactories.daemonHealth())
vi.mock('./daemon-pid-identity', () => moduleFactories.daemonPidIdentity())
vi.mock('./daemon-tcc-attribution', () => moduleFactories.daemonTccAttribution())
vi.mock('./daemon-bundle-staleness', () => moduleFactories.daemonBundleStaleness())
vi.mock('./daemon-stale-kill', () => moduleFactories.daemonStaleKill())
vi.mock('./daemon-process-start-time', () => moduleFactories.daemonProcessStartTime())
vi.mock('./daemon-pid-file-parse', () => moduleFactories.daemonPidFileParse())
vi.mock('./client', () => moduleFactories.client())
vi.mock('./daemon-spawner', () => moduleFactories.daemonSpawner())
vi.mock('./daemon-pty-adapter', () => moduleFactories.daemonPtyAdapter())
vi.mock('../ipc/pty', () => moduleFactories.ipcPty())

describe('daemon-init: runRestartDaemon (7-step sequence)', () => {
  beforeEach(() => {
    installDefaultNetConnectStub()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('uses the direct daemon entry when Electron app path is already out/main', async () => {
    probeSocketExistsMock.mockImplementation((p?: string) => p === FAKE_DAEMON_ENTRY_PATH)
    const mod = await importFresh()
    getAppPathMock.mockReturnValue(FAKE_APP_OUT_MAIN_PATH)
    checkDaemonHealthMock.mockResolvedValue('unreachable')
    await mod.initDaemonPtyProvider()

    const launcher = spawnerInstances[0].launcher as (
      socketPath: string,
      tokenPath: string
    ) => Promise<{ shutdown(): Promise<void> }>
    forkMock.mockImplementationOnce(() => {
      const handlers: Record<string, ((arg?: unknown) => void)[]> = {
        message: [],
        error: [],
        exit: []
      }
      return {
        pid: 12345,
        on(event: string, cb: (arg?: unknown) => void) {
          handlers[event]?.push(cb)
          if (event === 'message') {
            queueMicrotask(() => cb({ type: 'ready', startedAtMs: 1_000_000 }))
          }
          return this
        },
        off(event: string, cb: (arg?: unknown) => void) {
          handlers[event] = handlers[event]?.filter((handler) => handler !== cb) ?? []
          return this
        },
        disconnect: vi.fn(),
        unref: vi.fn()
      }
    })

    await launcher('/fake/socket', '/fake/token')

    expect(forkMock).toHaveBeenCalledWith(
      FAKE_DAEMON_ENTRY_PATH,
      expect.arrayContaining([
        '--socket',
        '/fake/socket',
        '--token',
        '/fake/token',
        '--log-file',
        join(FAKE_USER_DATA_PATH, 'logs', 'daemon.log')
      ]),
      expect.objectContaining({ detached: true })
    )
  })

  it('attempts a new launch when startup finds no daemon to remove', async () => {
    const mod = await importFresh()
    await mod.initDaemonPtyProvider()
    checkDaemonHealthMock.mockResolvedValue('unreachable')
    killStaleDaemonMock.mockResolvedValueOnce({
      killed: false,
      liveOwnerSurvived: false
    })
    forkMock.mockImplementationOnce(() => {
      throw new Error('stop after replacement decision')
    })
    const launcher = spawnerInstances[0].launcher as (
      socketPath: string,
      tokenPath: string
    ) => Promise<{ shutdown(): Promise<void> }>

    await expect(launcher('/fake/socket', '/fake/token')).rejects.toThrow(
      'stop after replacement decision'
    )
    expect(forkMock).toHaveBeenCalledOnce()
    expect(killStaleDaemonMock).toHaveBeenCalled()
  })

  it.each(['unhealthy_resolver', 'stale_bundle'] as const)(
    'retries launch after self-retirement for a %s respawn request',
    async (reason) => {
      const mod = await importFresh()
      await mod.initDaemonPtyProvider()
      const adapterOptions = adapterInstances[0].options

      // The daemon is gone before the launcher looks: nothing answers, nothing left to kill.
      checkDaemonHealthMock.mockResolvedValue('unreachable')
      killStaleDaemonMock
        .mockResolvedValueOnce({ killed: false, liveOwnerSurvived: false })
        .mockResolvedValueOnce({ killed: false, liveOwnerSurvived: false })
      forkMock.mockImplementationOnce(() => {
        throw new Error('stop after replacement decision')
      })
      const launcher = spawnerInstances[0].launcher as (
        socketPath: string,
        tokenPath: string
      ) => Promise<{ shutdown(): Promise<void> }>

      await adapterOptions.respawn?.(reason)
      expect(spawnerInstances[0].resetHandle).toHaveBeenCalledOnce()
      expect(spawnerInstances[0].ensureRunning).toHaveBeenCalledTimes(2)

      await expect(launcher('/fake/socket', '/fake/token')).rejects.toThrow(
        'stop after replacement decision'
      )

      expect(forkMock).toHaveBeenCalledOnce()

      // A prior failed attempt must not prevent the next independent launch.
      forkMock.mockImplementationOnce(() => {
        throw new Error('stop after replacement decision')
      })
      await expect(launcher('/fake/socket', '/fake/token')).rejects.toThrow(
        'stop after replacement decision'
      )
      expect(forkMock).toHaveBeenCalledTimes(2)
    }
  )

  it('checks current launch identity after a resolver-triggered respawn', async () => {
    const mod = await importFresh()
    await mod.initDaemonPtyProvider()
    const adapterOptions = adapterInstances[0].options

    // Resolver recovered by the time the launcher looks, but the daemon is genuinely from another path.
    getMacDaemonSystemResolverHealthMock.mockReturnValue('healthy')
    getDaemonLaunchIdentityMock.mockReturnValueOnce('mismatch')
    forkMock.mockImplementationOnce(() => {
      throw new Error('stop after replacement decision')
    })
    const launcher = spawnerInstances[0].launcher as (
      socketPath: string,
      tokenPath: string
    ) => Promise<{ shutdown(): Promise<void> }>

    await adapterOptions.respawn?.('unhealthy_resolver')
    await expect(launcher('/fake/socket', '/fake/token')).rejects.toThrow(
      'stop after replacement decision'
    )
    expect(forkMock).toHaveBeenCalledOnce()
    expect(killStaleDaemonMock).toHaveBeenCalled()
  })

  it('attempts replacement when a resolver-triggered respawn fails the health check', async () => {
    const mod = await importFresh()
    await mod.initDaemonPtyProvider()
    const adapterOptions = adapterInstances[0].options

    // Daemon survived the disconnect (non-alive sessions keep it non-idle) but fails the spawn probe.
    checkDaemonHealthMock.mockResolvedValue('pty-spawn-unhealthy')
    forkMock.mockImplementationOnce(() => {
      throw new Error('stop after replacement decision')
    })
    const launcher = spawnerInstances[0].launcher as (
      socketPath: string,
      tokenPath: string
    ) => Promise<{ shutdown(): Promise<void> }>

    await adapterOptions.respawn?.('unhealthy_resolver')
    await expect(launcher('/fake/socket', '/fake/token')).rejects.toThrow(
      'stop after replacement decision'
    )
    expect(forkMock).toHaveBeenCalledOnce()
    expect(killStaleDaemonMock).toHaveBeenCalled()
  })

  it('attempts a new launch after protocol cleanup leaves no stale daemon to kill', async () => {
    const mod = await importFresh()
    await mod.initDaemonPtyProvider()

    getDaemonLaunchIdentityMock.mockReturnValueOnce('mismatch')
    killStaleDaemonMock.mockResolvedValueOnce({
      killed: false,
      liveOwnerSurvived: false
    })
    // The daemon answers cleanup's liveness probe, then the endpoint goes away so the self-shutdown
    // wait succeeds and cleanup reports cleaned:true.
    probeSocketExistsMock.mockReturnValue(true)
    netConnectMock.mockImplementationOnce(() => {
      const handlers: Record<string, (() => void)[]> = {
        connect: [],
        error: []
      }
      return {
        on(event: string, cb: () => void) {
          handlers[event]?.push(cb)
          if (event === 'connect') {
            queueMicrotask(() => cb())
          }
          return this
        },
        removeListener(event: string, cb: () => void) {
          handlers[event] = handlers[event]?.filter((handler) => handler !== cb) ?? []
          return this
        },
        destroy() {}
      }
    })
    forkMock.mockImplementationOnce(() => {
      throw new Error('stop after replacement decision')
    })
    const launcher = spawnerInstances[0].launcher as (
      socketPath: string,
      tokenPath: string
    ) => Promise<{ shutdown(): Promise<void> }>

    await expect(launcher('/fake/socket', '/fake/token')).rejects.toThrow(
      'stop after replacement decision'
    )

    expect(killStaleDaemonMock).toHaveBeenCalled()
    const requests = daemonClientMock.mock.results.flatMap((result) =>
      result.type === 'return'
        ? (result.value as { request: ReturnType<typeof vi.fn> }).request.mock.calls
        : []
    )
    expect(requests).toContainEqual(['shutdown', { killSessions: true }])
    expect(forkMock).toHaveBeenCalledOnce()

    // beforeEach only mockClear()s this one, so hand it back rather than leaving later tests probing a live endpoint.
    probeSocketExistsMock.mockReturnValue(false)
  })

  it('stays silent about replacing a daemon on a cold start, where there is none', async () => {
    // Why: a first launch reaches the same replace fall-through (unreachable health,
    // no socket, nothing to probe); announcing a replacement there reports killing a
    // daemon that never existed, on the most common path there is.
    const mod = await importFresh()
    await mod.initDaemonPtyProvider()

    // Both pre-spawn probes fail: nothing ever answers, so no session count is observed.
    const unreachableClient = function MockDaemonClient() {
      return {
        ensureConnected: vi.fn(async () => {
          throw new Error('connect ENOENT')
        }),
        ensureConnectedWithin: vi.fn(async () => {
          throw new Error('connect ENOENT')
        }),
        request: vi.fn(),
        disconnect: vi.fn()
      }
    }
    daemonClientMock
      .mockImplementationOnce(unreachableClient)
      .mockImplementationOnce(unreachableClient)

    const launcher = spawnerInstances[0].launcher as (
      socketPath: string,
      tokenPath: string
    ) => Promise<{ shutdown(): Promise<void> }>
    checkDaemonHealthMock.mockResolvedValueOnce('unreachable')
    probeSocketExistsMock.mockReturnValue(false)
    forkMock.mockImplementationOnce(() => ({
      pid: 12345,
      on(event: string, cb: (arg?: unknown) => void) {
        if (event === 'message') {
          queueMicrotask(() => cb({ type: 'ready', startedAtMs: 1_000_000 }))
        }
        return this
      },
      once() {
        return this
      },
      off() {
        return this
      },
      disconnect: vi.fn(),
      unref: vi.fn()
    }))

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      await launcher('/fake/socket', '/fake/token')

      expect(forkMock).toHaveBeenCalled()
      expect(warnSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Replacing daemon that failed the health check')
      )
    } finally {
      warnSpy.mockRestore()
    }
  })
})
