export function createAccountsApi(): never {
  const empty = {
    accounts: [],
    activeAccountId: null,
    activeAccountIdsByRuntime: { host: null, wsl: {} }
  }
  return {
    list: () => Promise.resolve(empty),
    add: () => Promise.resolve(empty),
    cancelPendingLogin: () => Promise.resolve(false),
    reauthenticate: () => Promise.resolve(empty),
    remove: () => Promise.resolve(empty),
    select: () => Promise.resolve(empty),
    // Why: launch accounts are recorded on the host that owns the PTY, which the
    // web client never is — report no stale panes rather than reject the sweep.
    listStalePanes: () => Promise.resolve([]),
    // Why empty rather than absent: the same host owns both records, so a web
    // client has no recorded lane to offer and every pane falls to derivation.
    listRecordedPaneLanes: () => Promise.resolve({}),
    forgetStalePanes: () => Promise.resolve()
  } as never
}
