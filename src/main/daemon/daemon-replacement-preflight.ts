import { getAppEnvironment } from '../../shared/app-environment'
import { isDaemonStaleForCurrentBundle } from './daemon-bundle-staleness'
import { DaemonEndpointOwnershipError } from './daemon-endpoint-adoption'
import { checkDaemonHealth, getMacDaemonSystemResolverHealth } from './daemon-health'
import {
  DAEMON_SOCKET_PROBE_TIMEOUT_MS,
  getAliveDaemonSessionCount,
  probeDaemonSocket as probeSocket
} from './daemon-launch-paths'
import { getDaemonLaunchIdentity } from './daemon-pid-identity'
import { cleanupDaemonForProtocol } from './daemon-protocol-cleanup'
import type { DaemonProcessHandle } from './daemon-spawner'
import { killStaleDaemon } from './daemon-stale-kill'
import { getMacDaemonTccAttributionHealth } from './daemon-tcc-attribution'
import { PROTOCOL_VERSION } from './types'

// Why a count on top of the wall clock: DAEMON_RECOVERY_BUDGET_MS ends the grace, but a socket
// that accepts and then resets the hello answers both probes instantly, so without this the loop
// would spin hot for the whole budget.
export const WEDGED_DAEMON_GRACE_RETRIES = 11

type PreserveDaemon = (mode?: 'degraded-new-pty-fallback') => Promise<DaemonProcessHandle>

type ReplacementPreflightOptions = {
  runtimeDir: string
  socketPath: string
  tokenPath: string
  entryPath: string
  /** Absolute deadline for the whole adopt-or-replace decision; see DAEMON_RECOVERY_BUDGET_MS. */
  recoveryDeadlineMs: number
  releaseAdoptionClient: () => void
  preserveDaemon: PreserveDaemon
}

export async function prepareDaemonReplacement(
  options: ReplacementPreflightOptions
): Promise<DaemonProcessHandle | null> {
  const {
    runtimeDir,
    socketPath,
    tokenPath,
    entryPath,
    recoveryDeadlineMs,
    releaseAdoptionClient,
    preserveDaemon
  } = options
  const health = await checkDaemonHealth(socketPath, tokenPath)
  if (health === 'healthy') {
    const resolverHealth = await getMacDaemonSystemResolverHealth(socketPath, tokenPath)
    if (resolverHealth === 'unhealthy') {
      const liveSessionCount = await getAliveDaemonSessionCount(
        socketPath,
        tokenPath,
        recoveryDeadlineMs
      )
      if (liveSessionCount !== 0) {
        console.warn(
          liveSessionCount === null
            ? '[daemon] Preserving daemon with unavailable macOS system resolver because live session state could not be verified'
            : `[daemon] Preserving daemon with unavailable macOS system resolver because it owns ${liveSessionCount} live session${liveSessionCount === 1 ? '' : 's'}`
        )
        return preserveDaemon()
      }
      console.warn('[daemon] Replacing daemon with unavailable macOS system resolver')
      await cleanupDaemonForProtocol(runtimeDir, PROTOCOL_VERSION)
    } else {
      // Why: a protocol-healthy daemon can outlive its launching app bundle (dev worktree rebuild, or packaged update replacing the app path).
      const identity = await getDaemonLaunchIdentity(runtimeDir, socketPath, tokenPath, entryPath)
      const stalePackagedBundle =
        getAppEnvironment().isPackaged() &&
        (await isDaemonStaleForCurrentBundle(
          runtimeDir,
          socketPath,
          tokenPath,
          getAppEnvironment().getVersion()
        ))
      if (identity === 'mismatch' || stalePackagedBundle) {
        // Why: replacing a healthy daemon kills its child PTYs; defer code freshness until no live sessions would be lost.
        const replacementLabel = stalePackagedBundle
          ? 'launched before the current app bundle was installed'
          : 'launched from a different app path'
        if (
          await shouldPreserveDaemonWithLiveSessions(
            socketPath,
            tokenPath,
            recoveryDeadlineMs,
            replacementLabel
          )
        ) {
          return preserveDaemon()
        }
        console.warn(
          stalePackagedBundle
            ? '[daemon] Replacing daemon launched before the current app bundle was installed'
            : '[daemon] Replacing daemon launched from a different app path'
        )
        // liveSessionCount is 0: shouldPreserveDaemonWithLiveSessions() only falls through at exactly 0.
        await cleanupDaemonForProtocol(runtimeDir, PROTOCOL_VERSION)
      } else {
        const attributionHealth = await getMacDaemonTccAttributionHealth(
          runtimeDir,
          socketPath,
          tokenPath
        )
        if (attributionHealth === 'severed') {
          // Why: replacing with live sessions would kill them; Settings → Developer
          // Permissions surfaces the Manage Sessions → Restart remedy instead.
          const liveSessionCount = await getAliveDaemonSessionCount(
            socketPath,
            tokenPath,
            recoveryDeadlineMs
          )
          if (liveSessionCount === 0) {
            console.warn(
              '[daemon] Replacing daemon whose macOS TCC attribution is severed (spawning app binary no longer exists)'
            )
            await cleanupDaemonForProtocol(runtimeDir, PROTOCOL_VERSION)
          } else {
            return preserveDaemon()
          }
        } else {
          // Why: healthy daemon from a previous session answered a protocol ping — safe to reuse.
          return preserveDaemon()
        }
      }
    }
  } else {
    // Why: a busy machine can time out the health check on a live daemon; re-verify with a session list before killing its sessions.
    let liveSessionCount = await getAliveDaemonSessionCount(
      socketPath,
      tokenPath,
      recoveryDeadlineMs
    )
    // Why: a wedged-but-connectable daemon (Windows update relaunch) may still own live sessions, so grace-retry before replacing; a permanent wedge (#8689) exhausts the grace, and 'rejected' skips it (handshake refused = never adoptable).
    // Why the clock term: without it the grace is however long the probes happen to take, which
    // ran past the startup PTY gate's fail-open cap and hung terminal restore (STA-5732).
    let graceRetry = 0
    while (
      liveSessionCount === null &&
      health !== 'rejected' &&
      graceRetry < WEDGED_DAEMON_GRACE_RETRIES &&
      Date.now() < recoveryDeadlineMs &&
      (await probeSocket(
        socketPath,
        Math.max(1, Math.min(DAEMON_SOCKET_PROBE_TIMEOUT_MS, recoveryDeadlineMs - Date.now()))
      ))
    ) {
      liveSessionCount = await getAliveDaemonSessionCount(socketPath, tokenPath, recoveryDeadlineMs)
      graceRetry++
    }
    if (liveSessionCount !== null && liveSessionCount > 0) {
      if (health === 'pty-spawn-unhealthy') {
        console.warn(
          `[daemon] DEGRADED MODE: preserving daemon that failed the PTY spawn health check because it owns ${liveSessionCount} live session${liveSessionCount === 1 ? '' : 's'}. Existing sessions keep working; fresh terminals run on the local provider WITHOUT daemon persistence until you restart the daemon (Manage Sessions → Restart).`
        )
        return preserveDaemon('degraded-new-pty-fallback')
      }
      console.warn(
        `[daemon] Preserving daemon that failed the health check because it owns ${liveSessionCount} live session${liveSessionCount === 1 ? '' : 's'}`
      )
      return preserveDaemon()
    }
    // Why: the sibling replace branches announce themselves, but this one used
    // to kill a daemon silently — leaving no way to tell a replacement apart
    // from an adoption after the fact. A cold start also lands here with
    // nothing to replace, so only speak up once something actually answered:
    // a probe that returned a count, a socket that survived a grace retry, or
    // a refused hello.
    if (liveSessionCount !== null || graceRetry > 0 || health === 'rejected') {
      console.warn(
        `[daemon] Replacing daemon that failed the health check (health=${health}, liveSessions=${liveSessionCount ?? 'unverifiable'}, graceRetries=${graceRetry})`
      )
    }
  }

  // Why: a raw socket can outlive a broken daemon; kill by PID before respawn so the new daemon doesn't race the stale one.
  releaseAdoptionClient()
  const killOutcome = await killStaleDaemon(runtimeDir, socketPath, tokenPath)
  if (killOutcome.liveOwnerSurvived) {
    // Why: forking beside a daemon we could not prove dead is precisely how the endpoint
    // owner and the session host diverge. But refusing outright would leave the user with
    // no daemon at all, and we have just proved something still answers the endpoint —
    // so adopt it in degraded mode: existing sessions keep working, new PTYs run locally.
    console.warn(
      '[daemon] DEGRADED MODE: adopting a daemon that could not be confirmed stopped. Existing sessions keep working; fresh terminals run on the local provider WITHOUT daemon persistence until you restart the daemon (Manage Sessions → Restart).'
    )
    try {
      return await preserveDaemon('degraded-new-pty-fallback')
    } catch {
      // It died between the probe and the adoption; the endpoint is genuinely free now.
      throw new DaemonEndpointOwnershipError(
        'Daemon replacement aborted: the existing daemon could not be confirmed stopped'
      )
    }
  }
  return null
}

async function shouldPreserveDaemonWithLiveSessions(
  socketPath: string,
  tokenPath: string,
  recoveryDeadlineMs: number,
  replacementLabel: string
): Promise<boolean> {
  const liveSessionCount = await getAliveDaemonSessionCount(
    socketPath,
    tokenPath,
    recoveryDeadlineMs
  )
  if (liveSessionCount === 0) {
    return false
  }
  console.warn(
    liveSessionCount === null
      ? `[daemon] Preserving daemon ${replacementLabel} because live session state could not be verified`
      : `[daemon] Preserving daemon ${replacementLabel} because it owns ${liveSessionCount} live session${liveSessionCount === 1 ? '' : 's'}`
  )
  return true
}
