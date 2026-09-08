import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getPathMock,
  getSavedRuntimeAiVaultHostInfosMock,
  scanRuntimeAiVaultSessionsMock,
  resolveRuntimeAiVaultSessionTitlesMock,
  prepareRuntimeAiVaultSessionResumeMock,
  registerCliHandlersMock,
  registerPreflightHandlersMock,
  registerUsageProviderHandlersMock,
  registerGitHubHandlersMock,
  registerStatsHandlersMock,
  registerMemoryHandlersMock,
  registerNotebookHandlersMock,
  registerNotificationHandlersMock,
  registerDeveloperPermissionHandlersMock,
  registerComputerUsePermissionHandlersMock,
  registerSettingsHandlersMock,
  registerKeybindingHandlersMock,
  registerDiagnosticsHandlersMock,
  registerTerminalRenderDesyncEvidenceHandlerMock,
  registerShellHandlersMock,
  registerSessionHandlersMock,
  registerUIHandlersMock,
  setTrustedUIRendererWebContentsIdMock,
  registerFilesystemHandlersMock,
  registerRuntimeHandlersMock,
  registerRuntimeEnvironmentHandlersMock,
  registerAiVaultHandlersMock,
  registerOrcaProfileHandlersMock,
  registerCodexAccountHandlersMock,
  registerAgentHookHandlersMock,
  registerAgentTrustHandlersMock,
  registerClaudeAccountHandlersMock,
  registerClipboardHandlersMock,
  setTrustedClipboardRendererWebContentsIdMock,
  registerRateLimitHandlersMock,
  registerBrowserHandlersMock,
  setAgentBrowserBridgeRefMock,
  setTrustedBrowserRendererWebContentsIdMock,
  registerFilesystemWatcherHandlersMock,
  registerAppHandlersMock,
  registerBitbucketHandlersMock,
  registerGitLabHandlersMock,
  registerHostedReviewHandlersMock,
  registerExportHandlersMock,
  registerCodexConfigSyncHandlersMock,
  registerOnboardingHandlersMock,
  registerDashboardPopoutHandlersMock,
  isDashboardPopoutRendererMock,
  registerTerminalPreviewHandlersMock,
  registerSkillsHandlersMock,
  registerSkillDeleteIpcHandlersMock,
  registerWorkspaceSpaceHandlersMock,
  registerWorkspacePortHandlersMock,
  registerLocalhostWorktreeLabelHandlersMock,
  registerNativeChatHandlersMock,
  registerEmulatorFrameStreamHandlersMock,
  registerEmulatorVideoStreamHandlersMock
} = vi.hoisted(() => ({
  getPathMock: vi.fn(() => '/test/user-data'),
  getSavedRuntimeAiVaultHostInfosMock: vi.fn(() => []),
  scanRuntimeAiVaultSessionsMock: vi.fn(),
  resolveRuntimeAiVaultSessionTitlesMock: vi.fn(),
  prepareRuntimeAiVaultSessionResumeMock: vi.fn(),
  registerCliHandlersMock: vi.fn(),
  registerPreflightHandlersMock: vi.fn(),
  registerUsageProviderHandlersMock: vi.fn(),
  registerGitHubHandlersMock: vi.fn(),
  registerStatsHandlersMock: vi.fn(),
  registerMemoryHandlersMock: vi.fn(),
  registerNotebookHandlersMock: vi.fn(),
  registerNotificationHandlersMock: vi.fn(),
  registerDeveloperPermissionHandlersMock: vi.fn(),
  registerComputerUsePermissionHandlersMock: vi.fn(),
  registerSettingsHandlersMock: vi.fn(),
  registerKeybindingHandlersMock: vi.fn(),
  registerDiagnosticsHandlersMock: vi.fn(),
  registerTerminalRenderDesyncEvidenceHandlerMock: vi.fn(),
  registerShellHandlersMock: vi.fn(),
  registerSessionHandlersMock: vi.fn(),
  registerUIHandlersMock: vi.fn(),
  setTrustedUIRendererWebContentsIdMock: vi.fn(),
  registerFilesystemHandlersMock: vi.fn(),
  registerRuntimeHandlersMock: vi.fn(),
  registerRuntimeEnvironmentHandlersMock: vi.fn(),
  registerAiVaultHandlersMock: vi.fn(),
  registerOrcaProfileHandlersMock: vi.fn(),
  registerCodexAccountHandlersMock: vi.fn(),
  registerAgentHookHandlersMock: vi.fn(),
  registerAgentTrustHandlersMock: vi.fn(),
  registerClaudeAccountHandlersMock: vi.fn(),
  registerClipboardHandlersMock: vi.fn(),
  setTrustedClipboardRendererWebContentsIdMock: vi.fn(),
  registerRateLimitHandlersMock: vi.fn(),
  registerBrowserHandlersMock: vi.fn(),
  setAgentBrowserBridgeRefMock: vi.fn(),
  setTrustedBrowserRendererWebContentsIdMock: vi.fn(),
  registerFilesystemWatcherHandlersMock: vi.fn(),
  registerAppHandlersMock: vi.fn(),
  registerBitbucketHandlersMock: vi.fn(),
  registerGitLabHandlersMock: vi.fn(),
  registerHostedReviewHandlersMock: vi.fn(),
  registerExportHandlersMock: vi.fn(),
  registerCodexConfigSyncHandlersMock: vi.fn(),
  registerOnboardingHandlersMock: vi.fn(),
  registerDashboardPopoutHandlersMock: vi.fn(),
  isDashboardPopoutRendererMock: vi.fn(),
  registerTerminalPreviewHandlersMock: vi.fn(),
  registerSkillsHandlersMock: vi.fn(),
  registerSkillDeleteIpcHandlersMock: vi.fn(),
  registerWorkspaceSpaceHandlersMock: vi.fn(),
  registerWorkspacePortHandlersMock: vi.fn(),
  registerLocalhostWorktreeLabelHandlersMock: vi.fn(),
  registerNativeChatHandlersMock: vi.fn(),
  registerEmulatorFrameStreamHandlersMock: vi.fn(),
  registerEmulatorVideoStreamHandlersMock: vi.fn()
}))

vi.mock('electron', () => ({
  app: {
    getPath: getPathMock
  }
}))

vi.mock('../../ai-vault/runtime-session-scanner', () => ({
  getSavedRuntimeAiVaultHostInfos: getSavedRuntimeAiVaultHostInfosMock,
  scanRuntimeAiVaultSessions: scanRuntimeAiVaultSessionsMock,
  resolveRuntimeAiVaultSessionTitles: resolveRuntimeAiVaultSessionTitlesMock,
  prepareRuntimeAiVaultSessionResume: prepareRuntimeAiVaultSessionResumeMock
}))

vi.mock('../codex-config-sync', () => ({
  registerCodexConfigSyncHandlers: registerCodexConfigSyncHandlersMock
}))

vi.mock('../onboarding', () => ({
  registerOnboardingHandlers: registerOnboardingHandlersMock
}))

vi.mock('../dashboard-popout', () => ({
  registerDashboardPopoutHandlers: registerDashboardPopoutHandlersMock
}))

vi.mock('../../window/dashboard-popout-window', () => ({
  isDashboardPopoutRenderer: isDashboardPopoutRendererMock
}))

vi.mock('../terminal-preview', () => ({
  registerTerminalPreviewHandlers: registerTerminalPreviewHandlersMock
}))

vi.mock('../cli', () => ({
  registerCliHandlers: registerCliHandlersMock
}))

vi.mock('../preflight', () => ({
  registerPreflightHandlers: registerPreflightHandlersMock
}))

vi.mock('../usage-provider-handlers', () => ({
  registerUsageProviderHandlers: registerUsageProviderHandlersMock
}))

vi.mock('../github', () => ({
  registerGitHubHandlers: registerGitHubHandlersMock
}))

vi.mock('../export', () => ({
  registerExportHandlers: registerExportHandlersMock
}))

vi.mock('../stats', () => ({
  registerStatsHandlers: registerStatsHandlersMock
}))

vi.mock('../memory', () => ({
  registerMemoryHandlers: registerMemoryHandlersMock
}))

vi.mock('../notebook', () => ({
  registerNotebookHandlers: registerNotebookHandlersMock
}))

vi.mock('../notifications', () => ({
  registerNotificationHandlers: registerNotificationHandlersMock
}))

vi.mock('../developer-permissions', () => ({
  registerDeveloperPermissionHandlers: registerDeveloperPermissionHandlersMock
}))

vi.mock('../computer-use-permissions', () => ({
  registerComputerUsePermissionHandlers: registerComputerUsePermissionHandlersMock
}))

vi.mock('../settings', () => ({
  registerSettingsHandlers: registerSettingsHandlersMock
}))

vi.mock('../skills', () => ({
  registerSkillsHandlers: registerSkillsHandlersMock
}))

vi.mock('../skill-delete/handlers', () => ({
  registerSkillDeleteIpcHandlers: registerSkillDeleteIpcHandlersMock
}))

vi.mock('../workspace-space', () => ({
  registerWorkspaceSpaceHandlers: registerWorkspaceSpaceHandlersMock
}))

vi.mock('../workspace-ports', () => ({
  registerWorkspacePortHandlers: registerWorkspacePortHandlersMock
}))

vi.mock('../localhost-worktree-labels', () => ({
  registerLocalhostWorktreeLabelHandlers: registerLocalhostWorktreeLabelHandlersMock
}))

vi.mock('../keybindings', () => ({
  registerKeybindingHandlers: registerKeybindingHandlersMock
}))

vi.mock('../diagnostics', () => ({
  registerDiagnosticsHandlers: registerDiagnosticsHandlersMock
}))

vi.mock('../shell', () => ({
  registerShellHandlers: registerShellHandlersMock
}))

vi.mock('../session', () => ({
  registerSessionHandlers: registerSessionHandlersMock
}))

vi.mock('../ui', () => ({
  registerUIHandlers: registerUIHandlersMock,
  setTrustedUIRendererWebContentsId: setTrustedUIRendererWebContentsIdMock
}))

vi.mock('../emulator-frame-stream', () => ({
  registerEmulatorFrameStreamHandlers: registerEmulatorFrameStreamHandlersMock
}))

vi.mock('../emulator-video-stream', () => ({
  registerEmulatorVideoStreamHandlers: registerEmulatorVideoStreamHandlersMock
}))

vi.mock('../filesystem', () => ({
  registerFilesystemHandlers: registerFilesystemHandlersMock
}))

vi.mock('../filesystem-watcher', () => ({
  registerFilesystemWatcherHandlers: registerFilesystemWatcherHandlersMock
}))

vi.mock('../rate-limits', () => ({
  registerRateLimitHandlers: registerRateLimitHandlersMock
}))

vi.mock('../runtime', () => ({
  registerRuntimeHandlers: registerRuntimeHandlersMock
}))

vi.mock('../runtime-environments', () => ({
  registerRuntimeEnvironmentHandlers: registerRuntimeEnvironmentHandlersMock
}))

vi.mock('../ai-vault', () => ({
  registerAiVaultHandlers: registerAiVaultHandlersMock
}))

vi.mock('../orca-profiles', () => ({
  registerOrcaProfileHandlers: registerOrcaProfileHandlersMock
}))

vi.mock('../codex-accounts', () => ({
  registerCodexAccountHandlers: registerCodexAccountHandlersMock
}))

vi.mock('../agent-hooks', () => ({
  registerAgentHookHandlers: registerAgentHookHandlersMock
}))

vi.mock('../agent-trust', () => ({
  registerAgentTrustHandlers: registerAgentTrustHandlersMock
}))

vi.mock('../claude-accounts', () => ({
  registerClaudeAccountHandlers: registerClaudeAccountHandlersMock
}))

vi.mock('../../window/clipboard-ipc-handlers', () => ({
  registerClipboardHandlers: registerClipboardHandlersMock,
  setTrustedClipboardRendererWebContentsId: setTrustedClipboardRendererWebContentsIdMock
}))

vi.mock('../browser', () => ({
  registerBrowserHandlers: registerBrowserHandlersMock,
  setAgentBrowserBridgeRef: setAgentBrowserBridgeRefMock
}))

vi.mock('../browser-renderer-trust', () => ({
  setTrustedBrowserRendererWebContentsId: setTrustedBrowserRendererWebContentsIdMock
}))

vi.mock('../app', () => ({
  registerAppHandlers: registerAppHandlersMock
}))

vi.mock('../terminal-render-desync-evidence', () => ({
  registerTerminalRenderDesyncEvidenceHandler: registerTerminalRenderDesyncEvidenceHandlerMock
}))

vi.mock('../bitbucket', () => ({
  registerBitbucketHandlers: registerBitbucketHandlersMock
}))

vi.mock('../gitlab', () => ({
  registerGitLabHandlers: registerGitLabHandlersMock
}))

vi.mock('../hosted-review', () => ({
  registerHostedReviewHandlers: registerHostedReviewHandlersMock
}))

vi.mock('../native-chat', () => ({
  registerNativeChatHandlers: registerNativeChatHandlersMock
}))

import { registerCoreHandlers } from './register-core-handlers'

describe('registerCoreHandlers', () => {
  beforeEach(() => {
    getPathMock.mockReset()
    getPathMock.mockReturnValue('/test/user-data')
    getSavedRuntimeAiVaultHostInfosMock.mockReset().mockReturnValue([])
    scanRuntimeAiVaultSessionsMock.mockReset()
    resolveRuntimeAiVaultSessionTitlesMock.mockReset()
    prepareRuntimeAiVaultSessionResumeMock.mockReset()
    registerCliHandlersMock.mockReset()
    registerPreflightHandlersMock.mockReset()
    registerUsageProviderHandlersMock.mockReset()
    registerGitHubHandlersMock.mockReset()
    registerStatsHandlersMock.mockReset()
    registerMemoryHandlersMock.mockReset()
    registerNotebookHandlersMock.mockReset()
    registerNotificationHandlersMock.mockReset()
    registerDeveloperPermissionHandlersMock.mockReset()
    registerComputerUsePermissionHandlersMock.mockReset()
    registerSettingsHandlersMock.mockReset()
    registerKeybindingHandlersMock.mockReset()
    registerDiagnosticsHandlersMock.mockReset()
    registerTerminalRenderDesyncEvidenceHandlerMock.mockReset()
    registerShellHandlersMock.mockReset()
    registerSessionHandlersMock.mockReset()
    registerUIHandlersMock.mockReset()
    setTrustedUIRendererWebContentsIdMock.mockReset()
    registerFilesystemHandlersMock.mockReset()
    registerRuntimeHandlersMock.mockReset()
    registerRuntimeEnvironmentHandlersMock.mockReset()
    registerAiVaultHandlersMock.mockReset()
    registerOrcaProfileHandlersMock.mockReset()
    registerCodexAccountHandlersMock.mockReset()
    registerAgentHookHandlersMock.mockReset()
    registerAgentTrustHandlersMock.mockReset()
    registerClaudeAccountHandlersMock.mockReset()
    registerClipboardHandlersMock.mockReset()
    setTrustedClipboardRendererWebContentsIdMock.mockReset()
    registerRateLimitHandlersMock.mockReset()
    registerBrowserHandlersMock.mockReset()
    setAgentBrowserBridgeRefMock.mockReset()
    setTrustedBrowserRendererWebContentsIdMock.mockReset()
    registerFilesystemWatcherHandlersMock.mockReset()
    registerAppHandlersMock.mockReset()
    registerBitbucketHandlersMock.mockReset()
    registerGitLabHandlersMock.mockReset()
    registerHostedReviewHandlersMock.mockReset()
    registerExportHandlersMock.mockReset()
    registerDashboardPopoutHandlersMock.mockReset()
    registerTerminalPreviewHandlersMock.mockReset()
    registerSkillsHandlersMock.mockReset()
    registerSkillDeleteIpcHandlersMock.mockReset()
    registerWorkspaceSpaceHandlersMock.mockReset()
    registerWorkspacePortHandlersMock.mockReset()
    registerLocalhostWorktreeLabelHandlersMock.mockReset()
    registerNativeChatHandlersMock.mockReset()
    registerEmulatorFrameStreamHandlersMock.mockReset()
    registerEmulatorVideoStreamHandlersMock.mockReset()
  })

  it('passes the store through to handler registrars that need it', async () => {
    const store = { marker: 'store' }
    const runtime = { marker: 'runtime', getAgentBrowserBridge: () => null }
    const stats = { marker: 'stats' }
    const claudeUsage = { marker: 'claudeUsage' }
    const codexUsage = { marker: 'codexUsage' }
    const codexAccounts = { marker: 'codexAccounts', runtimeHomeService: { marker: 'runtimeHome' } }
    const claudeAccounts = { marker: 'claudeAccounts' }
    const rateLimits = { marker: 'rateLimits' }
    const agentAwakeService = { marker: 'agentAwakeService' }
    const onBeforeRelaunch = vi.fn()
    const getAdditionalAiVaultCodexHomePaths = vi.fn(() => ['/runtime/codex/home'])

    registerCoreHandlers(
      store as never,
      runtime as never,
      stats as never,
      claudeUsage as never,
      codexUsage as never,
      codexAccounts as never,
      claudeAccounts as never,
      rateLimits as never,
      null,
      undefined,
      undefined,
      agentAwakeService as never,
      undefined,
      undefined,
      { getAdditionalAiVaultCodexHomePaths, onBeforeRelaunch }
    )

    const aiVaultOptions = registerAiVaultHandlersMock.mock.calls[0]?.[0]
    expect(aiVaultOptions).toBeDefined()

    expect(registerUsageProviderHandlersMock).toHaveBeenCalledWith({
      claudeUsage,
      codexUsage
    })
    expect(registerAppHandlersMock).toHaveBeenCalledWith(store, { onBeforeRelaunch })
    expect(registerCodexAccountHandlersMock).toHaveBeenCalledWith(
      codexAccounts,
      expect.any(Function)
    )
    expect(registerAgentHookHandlersMock).toHaveBeenCalledWith(runtime, {
      getPtyIdForPaneKey: expect.any(Function)
    })
    expect(registerCodexConfigSyncHandlersMock).toHaveBeenCalledWith(
      codexAccounts.runtimeHomeService
    )
    expect(registerClaudeAccountHandlersMock).toHaveBeenCalledWith(claudeAccounts)
    expect(registerRateLimitHandlersMock).toHaveBeenCalledWith(rateLimits, codexAccounts)
    expect(registerGitHubHandlersMock).toHaveBeenCalledWith(store, stats)
    expect(registerBitbucketHandlersMock).toHaveBeenCalled()
    expect(registerGitLabHandlersMock).toHaveBeenCalledWith(store)
    expect(registerHostedReviewHandlersMock).toHaveBeenCalledWith(store, stats)
    expect(registerStatsHandlersMock).toHaveBeenCalledWith(stats)
    expect(registerMemoryHandlersMock).toHaveBeenCalledWith(store)
    expect(registerNotebookHandlersMock).toHaveBeenCalledWith(store)
    expect(registerNotificationHandlersMock).toHaveBeenCalledWith(store)
    expect(registerDeveloperPermissionHandlersMock).toHaveBeenCalled()
    expect(registerComputerUsePermissionHandlersMock).toHaveBeenCalled()
    expect(registerDashboardPopoutHandlersMock).toHaveBeenCalledWith(store, undefined)
    expect(registerTerminalPreviewHandlersMock).toHaveBeenCalledWith(runtime)
    expect(registerSettingsHandlersMock).toHaveBeenCalledWith(store, agentAwakeService)
    expect(registerSkillsHandlersMock).toHaveBeenCalledWith(store, runtime)
    expect(registerSkillDeleteIpcHandlersMock).toHaveBeenCalledWith(store, runtime)
    expect(registerWorkspaceSpaceHandlersMock).toHaveBeenCalledWith(store)
    expect(registerWorkspacePortHandlersMock).toHaveBeenCalledWith(store)
    expect(registerLocalhostWorktreeLabelHandlersMock).toHaveBeenCalledWith(store)
    expect(registerOrcaProfileHandlersMock).toHaveBeenCalledWith(store, { onBeforeRelaunch })
    expect(registerSessionHandlersMock).toHaveBeenCalledWith(store)
    expect(registerUIHandlersMock).toHaveBeenCalledWith(store, {
      isDashboardPopoutRenderer: isDashboardPopoutRendererMock
    })
    expect(registerEmulatorFrameStreamHandlersMock).toHaveBeenCalled()
    expect(registerEmulatorVideoStreamHandlersMock).toHaveBeenCalled()
    expect(registerFilesystemHandlersMock).toHaveBeenCalledWith(store)
    expect(registerRuntimeHandlersMock).toHaveBeenCalledWith(runtime)
    expect(registerRuntimeEnvironmentHandlersMock).toHaveBeenCalledWith(store)
    expect(registerAiVaultHandlersMock).toHaveBeenCalledWith(
      expect.objectContaining({
        getAdditionalCodexHomePaths: getAdditionalAiVaultCodexHomePaths,
        getActiveRuntimeAiVaultHostInfos: expect.any(Function),
        scanRuntimeAiVaultSessions: expect.any(Function),
        prepareRuntimeSessionResume: expect.any(Function)
      })
    )
    expect(aiVaultOptions.getActiveRuntimeAiVaultHostInfos()).toEqual([])
    expect(registerNativeChatHandlersMock).toHaveBeenCalled()
    expect(registerCliHandlersMock).toHaveBeenCalled()
    expect(registerPreflightHandlersMock).toHaveBeenCalled()
    expect(registerShellHandlersMock).toHaveBeenCalledWith(store)
    expect(registerClipboardHandlersMock).toHaveBeenCalledWith(store)
    expect(setTrustedBrowserRendererWebContentsIdMock).toHaveBeenCalledWith(null)
    expect(setTrustedClipboardRendererWebContentsIdMock).toHaveBeenCalledWith(null)
    expect(setTrustedUIRendererWebContentsIdMock).toHaveBeenCalledWith(null)
    expect(registerBrowserHandlersMock).toHaveBeenCalled()
    expect(registerFilesystemWatcherHandlersMock).toHaveBeenCalled()

    const prepareArgs = {
      agent: 'codex',
      filePath: '/managed/sessions/2026/07/20/rollout-a.jsonl',
      codexHome: '/managed',
      executionHostId: 'runtime:env-123'
    }
    aiVaultOptions.prepareRuntimeSessionResume('env-123', prepareArgs)
    expect(prepareRuntimeAiVaultSessionResumeMock).toHaveBeenCalledWith(
      '/test/user-data',
      'env-123',
      prepareArgs
    )
  })

  it('only registers IPC handlers once but always updates web contents id', () => {
    // The first test already called registerCoreHandlers, so the module-level
    // guard is now set. beforeEach reset all mocks, so call counts are 0.
    const store2 = { marker: 'store2' }
    const runtime2 = { marker: 'runtime2', getAgentBrowserBridge: () => null }
    const stats2 = { marker: 'stats2' }
    const claudeUsage2 = { marker: 'claudeUsage2' }
    const codexUsage2 = { marker: 'codexUsage2' }
    const codexAccounts2 = { marker: 'codexAccounts2' }
    const claudeAccounts2 = { marker: 'claudeAccounts2' }
    const rateLimits2 = { marker: 'rateLimits2' }

    registerCoreHandlers(
      store2 as never,
      runtime2 as never,
      stats2 as never,
      claudeUsage2 as never,
      codexUsage2 as never,
      codexAccounts2 as never,
      claudeAccounts2 as never,
      rateLimits2 as never,
      42
    )

    // Web contents ID should always be updated
    expect(setTrustedBrowserRendererWebContentsIdMock).toHaveBeenCalledWith(42)
    expect(setTrustedClipboardRendererWebContentsIdMock).toHaveBeenCalledWith(42)
    expect(setTrustedUIRendererWebContentsIdMock).toHaveBeenCalledWith(42)
    // IPC handlers should NOT be registered again
    expect(registerCliHandlersMock).not.toHaveBeenCalled()
    expect(registerPreflightHandlersMock).not.toHaveBeenCalled()
    expect(registerBrowserHandlersMock).not.toHaveBeenCalled()
    // Why: ipcMain.handle throws on duplicate channel registration, so the
    // memory handler must not be wired up a second time on reactivation.
    expect(registerMemoryHandlersMock).not.toHaveBeenCalled()
  })
})
