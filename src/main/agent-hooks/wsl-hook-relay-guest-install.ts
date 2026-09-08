// The install pass a connected WSL relay runs inside its guest: the managed
// hook installers and the interval policy that
// decides when a still-running relay may install again. Kept out of the
// manager so that file stays about relay lifecycle.
import type { ManagedHookDetectionSettings } from './managed-hook-detection-commands'
import type { installRemoteManagedAgentHooks } from './remote-managed-hook-installers'
import { installWslGuestHooks } from './wsl-hook-fs-adapter'
import { REINSTALL_MIN_INTERVAL_MS, type WslHookRelayManagerDeps } from './wsl-hook-relay-deps'
import type { SshChannelMultiplexer } from '../ssh/ssh-channel-multiplexer'

/** Structural slice of WslHookRelayManagerDeps — only what an install pass uses. */
type GuestInstallDeps = {
  installHooks: typeof installRemoteManagedAgentHooks
  installCodex: WslHookRelayManagerDeps['installCodex']
  managedHookSettings: () => ManagedHookDetectionSettings
  warn: (message: string) => void
}

/** Structural slice of the manager's DistroState this pass reads and writes. */
type GuestInstallState = {
  distro: string
  mux?: SshChannelMultiplexer
  guestHome?: string
  codexHomePath?: string
  lastInstallAt?: number
}

export async function runWslRelayGuestInstall(
  deps: GuestInstallDeps,
  state: GuestInstallState,
  mux: SshChannelMultiplexer,
  guestHome: string
): Promise<void> {
  state.lastInstallAt = Date.now()
  await installWslGuestHooks({
    mux,
    guestHome,
    codexHomePath: state.codexHomePath ?? null,
    distro: state.distro,
    installHooks: deps.installHooks,
    installCodex: deps.installCodex,
    settings: deps.managedHookSettings(),
    warn: deps.warn
  })
}

/** Rate-limited repeat of the (byte-equality idempotent) install pass on a live relay. */
export async function maybeRerunWslRelayGuestInstall(
  deps: GuestInstallDeps,
  state: GuestInstallState
): Promise<void> {
  const mux = state.mux
  const guestHome = state.guestHome
  if (
    !mux ||
    !guestHome ||
    mux.isDisposed() ||
    Date.now() - (state.lastInstallAt ?? 0) < REINSTALL_MIN_INTERVAL_MS
  ) {
    return
  }
  try {
    await runWslRelayGuestInstall(deps, state, mux, guestHome)
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    deps.warn(`[agent-hooks] WSL hook reinstall for '${state.distro}' failed: ${detail}`)
  }
}
