import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { PreloadApi } from './api-types'
import {
  installBrowserFindListener,
  installNativeFileDropHandlers
} from './preload-runtime-support'
import { appApi } from './api/app-bridge'
import { orcaProfilesApi } from './api/orca-profiles-bridge'
import { platformApi } from './api/platform-bridge'
import { wslApi } from './api/wsl-bridge'
import { pwshApi } from './api/pwsh-bridge'
import { gitBashApi } from './api/git-bash-bridge'
import { pluginsApi } from './api/plugins-bridge'
import { reposApi } from './api/repos-bridge'
import { projectsApi } from './api/projects-bridge'
import { projectGroupsApi } from './api/project-groups-bridge'
import { folderWorkspacesApi } from './api/folder-workspaces-bridge'
import { sparsePresetsApi } from './api/sparse-presets-bridge'
import { worktreesApi } from './api/worktrees-bridge'
import { workspaceCleanupApi } from './api/workspace-cleanup-bridge'
import { workspaceSpaceApi } from './api/workspace-space-bridge'
import { workspacePortsApi } from './api/workspace-ports-bridge'
import { ptyApi } from './api/pty-bridge'
import { crashReportsApi } from './api/crash-reports-bridge'
import { exportApi } from './api/export-bridge'
import { ghApi } from './api/gh-bridge'
import { hostedReviewApi } from './api/hosted-review-bridge'
import { glApiBridge } from './api/gl-bridge'
import { bitbucketApi } from './api/bitbucket-bridge'
import { diagnosticsApi } from './api/diagnostics-bridge'
import { settingsApi } from './api/settings-bridge'
import { agentAwakeApi } from './api/agent-awake-bridge'
import { localhostWorktreeLabelsApi } from './api/localhost-worktree-labels-bridge'
import { keybindingsApi } from './api/keybindings-bridge'
import { codexAccountsApi } from './api/codex-accounts-bridge'
import { claudeAccountsApi } from './api/claude-accounts-bridge'
import { cliApi } from './api/cli-bridge'
import { codexConfigSyncApi } from './api/codex-config-sync-bridge'
import { agentTrustApi } from './api/agent-trust-bridge'
import { preflightApi } from './api/preflight-bridge'
import { notificationsApi } from './api/notifications-bridge'
import { onboardingApi } from './api/onboarding-bridge'
import { dashboardApi } from './api/dashboard-bridge'
import { terminalPreviewApi } from './api/terminal-preview-bridge'
import { macosTccPromptsApi } from './api/macos-tcc-prompts-bridge'
import { developerPermissionsApi } from './api/developer-permissions-bridge'
import { computerUsePermissionsApi } from './api/computer-use-permissions-bridge'
import { shellApi } from './api/shell-bridge'
import { skillsApi } from './api/skills-bridge'
import { browserApi } from './api/browser-bridge'
import { emulatorApi } from './api/emulator-bridge'
import { hooksApi } from './api/hooks-bridge'
import { cacheApi } from './api/cache-bridge'
import { sessionApi } from './api/session-bridge'
import { remoteWorkspaceApi } from './api/remote-workspace-bridge'
import { docPreviewApi } from './api/doc-preview-bridge'
import { notebookApi } from './api/notebook-bridge'
import { fsApi } from './api/fs-bridge'
import { gitApi } from './api/git-bridge'
import { uiApi } from './api/ui-bridge'
import { statsApi } from './api/stats-bridge'
import { memoryApi } from './api/memory-bridge'
import { claudeUsageApi } from './api/claude-usage-bridge'
import { codexUsageApi } from './api/codex-usage-bridge'
import { aiVaultApi } from './api/ai-vault-bridge'
import { nativeChatApi } from './api/native-chat-bridge'
import { runtimeApi } from './api/runtime-bridge'
import { runtimeEnvironmentsApi } from './api/runtime-environments-bridge'
import { rateLimitsApi } from './api/rate-limits-bridge'
import { sshApi } from './api/ssh-bridge'
import { automationsApi } from './api/automations-bridge'
import { e2eApi } from './api/e2e-bridge'
import { agentStatusApi } from './api/agent-status-bridge'

installNativeFileDropHandlers()
installBrowserFindListener()

const api = {
  app: appApi,
  orcaProfiles: orcaProfilesApi,
  platform: platformApi,
  wsl: wslApi,
  pwsh: pwshApi,
  gitBash: gitBashApi,
  plugins: pluginsApi,
  repos: reposApi,
  projects: projectsApi,
  projectGroups: projectGroupsApi,
  folderWorkspaces: folderWorkspacesApi,
  sparsePresets: sparsePresetsApi,
  worktrees: worktreesApi,
  workspaceCleanup: workspaceCleanupApi,
  workspaceSpace: workspaceSpaceApi,
  workspacePorts: workspacePortsApi,
  pty: ptyApi,
  crashReports: crashReportsApi,
  export: exportApi,
  gh: ghApi,
  hostedReview: hostedReviewApi,
  gl: glApiBridge,
  bitbucket: bitbucketApi,
  diagnostics: diagnosticsApi,
  settings: settingsApi,
  agentAwake: agentAwakeApi,
  localhostWorktreeLabels: localhostWorktreeLabelsApi,
  keybindings: keybindingsApi,
  codexAccounts: codexAccountsApi,
  claudeAccounts: claudeAccountsApi,
  cli: cliApi,
  codexConfigSync: codexConfigSyncApi,
  agentTrust: agentTrustApi,
  preflight: preflightApi,
  notifications: notificationsApi,
  onboarding: onboardingApi,
  dashboard: dashboardApi,
  terminalPreview: terminalPreviewApi,
  macosTccPrompts: macosTccPromptsApi,
  developerPermissions: developerPermissionsApi,
  computerUsePermissions: computerUsePermissionsApi,
  shell: shellApi,
  skills: skillsApi,
  browser: browserApi,
  emulator: emulatorApi,
  hooks: hooksApi,
  cache: cacheApi,
  session: sessionApi,
  remoteWorkspace: remoteWorkspaceApi,
  docPreview: docPreviewApi,
  notebook: notebookApi,
  fs: fsApi,
  git: gitApi,
  ui: uiApi,
  stats: statsApi,
  memory: memoryApi,
  claudeUsage: claudeUsageApi,
  codexUsage: codexUsageApi,
  aiVault: aiVaultApi,
  nativeChat: nativeChatApi,
  runtime: runtimeApi,
  runtimeEnvironments: runtimeEnvironmentsApi,
  rateLimits: rateLimitsApi,
  ssh: sshApi,
  automations: automationsApi,
  e2e: e2eApi,
  agentStatus: agentStatusApi
} satisfies PreloadApi

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}
