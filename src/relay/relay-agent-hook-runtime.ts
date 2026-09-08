import type { RelayDispatcher } from './dispatcher'
import type { PtyHandler } from './pty-handler'
import { RelayAgentHookServer } from './agent-hook-server'
import { endpointDirForRelaySocket } from './agent-hook-endpoint-coordinates'
import { AGENT_HOOK_REQUEST_REPLAY_METHOD } from '../shared/agent-hook-relay'
import { publishAgentHookEnvelope } from './agent-hook-envelope-publication'
import { relayLogLine } from './relay-diagnostic-log'
import { registerManagedHookInstaller } from './managed-hook-installer'

export class RelayAgentHookRuntime {
  private readonly hookServer: RelayAgentHookServer

  constructor(
    private readonly dispatcher: RelayDispatcher,
    private readonly ptyHandler: PtyHandler,
    sockPath: string,
    endpointDir?: string
  ) {
    this.hookServer = new RelayAgentHookServer({
      endpointDir: endpointDir ?? endpointDirForRelaySocket(sockPath),
      forward: (envelope) => publishAgentHookEnvelope(dispatcher, envelope),
      // Why: the PTY handler is the only component that knows which panes still have a client
      // surface, so it — not the client — decides whether a hook post describes a live pane.
      isPaneSurfaceRetired: (paneKey) => ptyHandler.isPaneSurfaceRetired(paneKey)
    })
  }

  async start(): Promise<void> {
    try {
      await this.hookServer.start({ publishEndpoint: false })
    } catch (error) {
      relayLogLine(
        `[relay] agent-hook server failed to start: ${error instanceof Error ? error.message : String(error)}`
      )
    }
    this.registerPtyEnvironment()
    this.registerHandlers()
  }

  publishEndpointFile(): void {
    this.hookServer.publishEndpointFile()
  }

  stop(): void {
    this.hookServer.stop()
  }

  private registerPtyEnvironment(): void {
    this.ptyHandler.addEnvAugmenter(() => this.hookServer.buildPtyEnv())
    this.ptyHandler.setExitListener(({ paneKey }) => {
      if (paneKey) {
        this.hookServer.clearPaneState(paneKey)
      }
    })
    // Why: the exit listener above only fires on proof of process death, which a shell that
    // survives teardown never produces. Drop the pane's cached status the moment its tab goes, so a
    // reconnecting client cannot be handed a replay of an agent nobody owns.
    this.ptyHandler.setSurfaceRetiredListener(({ paneKey }) => {
      this.hookServer.clearPaneState(paneKey)
    })
  }

  private registerHandlers(): void {
    this.dispatcher.onRequest(AGENT_HOOK_REQUEST_REPLAY_METHOD, async () => ({
      replayed: this.hookServer.replayCachedPayloadsForPanes()
    }))
    registerManagedHookInstaller(this.dispatcher)
  }
}
