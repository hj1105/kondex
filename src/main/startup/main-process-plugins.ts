import { app, BrowserWindow } from 'electron'
import { performance } from 'node:perf_hooks'
import { PluginService } from '../plugins/plugin-service'
import { PluginMarketplaceService } from '../plugins/plugin-marketplace-service'
import { PluginMarketplaceInstaller } from '../plugins/plugin-marketplace-installer'
import { getPluginsDataDir } from '../plugins/plugin-discovery'
import { resolvePluginHostEntryPath } from '../plugins/plugin-host-process'
import { applyPluginConsent, applyPluginEnablement } from '../plugins/plugin-enablement'
import { setPluginServiceForRpc } from '../runtime/rpc/methods/plugins'
import {
  normalizePluginConsents,
  normalizePluginIdList
} from '../../shared/plugins/plugin-consent-state'
import { setMainPluginLanguagePacks, setMainUiLanguage } from '../i18n/main-i18n'
import { rebuildAppMenu } from '../menu/register-app-menu'
import { logStartupMilestone } from './startup-diagnostics'
import { agentHookServer } from '../agent-hooks/server'
import { emitPluginWorktreeLifecycle } from './main-process-pty-startup'
import { mainProcessState as state } from './main-process-state'
import type { OrcaRuntimeService } from '../runtime/orca-runtime'

export async function initializeMainProcessPlugins(runtime: OrcaRuntimeService): Promise<void> {
  const store = state.store
  const keybindings = state.keybindings
  if (!store || !keybindings) {
    throw new Error('Store and keybindings must be initialized before plugins')
  }
  const pluginSystemStartupStartedAt = performance.now()
  state.pluginMarketplaceService = new PluginMarketplaceService({
    pluginsDataDir: getPluginsDataDir(app.getPath('userData')),
    getKillListEntry: () => null
  })
  state.pluginMarketplaceInstaller = new PluginMarketplaceInstaller({
    marketplace: state.pluginMarketplaceService,
    userDataPath: app.getPath('userData'),
    hostVersion: app.getVersion(),
    blockedPluginReason: () => null
  })
  state.pluginService = new PluginService({
    userDataPath: app.getPath('userData'),
    hostVersion: app.getVersion(),
    // Feature flag: with the setting off, discovery returns nothing and no
    // plugin code path runs at all.
    isPluginSystemEnabled: () => state.store?.getSettings().pluginSystemEnabled === true,
    getDisabledPlugins: () => normalizePluginIdList(state.store?.getSettings().disabledPlugins),
    getPluginConsents: () => normalizePluginConsents(state.store?.getSettings().pluginConsents),
    getDevPluginPaths: () => normalizePluginIdList(state.store?.getSettings().devPluginPaths),
    getKeybindings: () => state.keybindings?.getOverrides() ?? {},
    getPluginKillListEntry: () => null,
    hostEntryPath: resolvePluginHostEntryPath(app.getAppPath(), app.isPackaged)
  })
  // Why: headless `orca serve` clients reach plugins through the runtime RPC
  // methods, which resolve the service via this module-level setter. Consent
  // over RPC uses the same hash-keyed write path as the desktop dialog.
  setPluginServiceForRpc(state.pluginService, {
    applyConsent: (request) =>
      applyPluginConsent({ store, pluginService: state.pluginService!, ...request }),
    applyEnablement: (pluginKey, enabled) =>
      applyPluginEnablement({ store, pluginService: state.pluginService!, pluginKey, enabled })
  })
  // Lazy kernel: initialize() only discovers manifests — no worker forks, no
  // panel reads. Zero plugin code runs before an explicit trigger.
  void state.pluginService
    .initialize()
    .then(() => {
      logStartupMilestone('plugin-system-initialized', {
        durationMs: Number((performance.now() - pluginSystemStartupStartedAt).toFixed(2)),
        installedPlugins: state.pluginService?.getDiscovered().length ?? 0
      })
    })
    .catch((error) => console.warn('[plugins] failed to initialize plugin service:', error))
  state.pluginService.onChanged((event) => {
    if (
      event.contentPacksChanged &&
      setMainPluginLanguagePacks(state.pluginService?.contentPacks.languagePacks.list() ?? [])
    ) {
      void setMainUiLanguage(store.getSettings().uiLanguage).then(() => rebuildAppMenu())
    }
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send('plugins:changed', event)
      }
    }
  })
  // v0 plugin event seams: agent status (hook pipeline tap) + worktree
  // lifecycle (runtime tap). Server-side filtered per plugin subscription.
  agentHookServer.subscribeEnrichedStatus((enriched) => {
    // Why: plugins may automate on `working`; restored rows are historical claims, not fresh activity.
    if (enriched.restoredUnconfirmed) {
      return
    }
    state.pluginService?.emitEvent('agent.status.changed', {
      worktreeId: enriched.worktreeId ?? null,
      paneKey: enriched.paneKey,
      state: enriched.payload.state,
      receivedAt: enriched.receivedAt
    })
  })
  runtime.onWorktreeLifecycle(emitPluginWorktreeLifecycle)
}
