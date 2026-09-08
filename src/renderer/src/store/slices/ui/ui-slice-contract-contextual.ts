import type { PersistedTrustedOrcaHooks } from '../../../../../shared/orca-yaml-hook-types'
import type { OrcaHookScriptKind } from '../../../lib/orca-hook-trust'
import type { SettingsNavigationTarget } from '../../../lib/settings-navigation-types'
import type { ExecutionHostId } from '../../../../../shared/execution-host'

export type UISliceContextual = {
  openSettingsPage: () => void
  closeSettingsPage: () => void
  settingsNavigationTarget: SettingsNavigationTarget | null
  openSettingsTarget: (target: NonNullable<UISliceContextual['settingsNavigationTarget']>) => void
  clearSettingsTarget: () => void
  /** Which host the Projects Settings pane shows per project (keyed by projectId). Ephemeral on purpose — never persisted, so reload reopens on the effective host. */
  settingsProjectHostSelection: Record<string, ExecutionHostId>
  settingsProjectSetupSelection: Record<string, string>
  setSettingsProjectHostSelection: (
    projectId: string,
    hostId: ExecutionHostId,
    setupId?: string
  ) => void
  /** One-shot Appearance accordion to expand for nested Settings deep links (e.g. Usage percentages under Window & Sidebar). Cleared when Appearance consumes it. */
  appearanceAccordionDeepLink: 'interface' | 'terminal' | 'window' | null
  setAppearanceAccordionDeepLink: (
    section: NonNullable<UISliceContextual['appearanceAccordionDeepLink']>
  ) => void
  clearAppearanceAccordionDeepLink: () => void
  activeModal:
    | 'none'
    | 'create-worktree'
    | 'edit-meta'
    | 'delete-worktree'
    | 'preserved-branch-review'
    | 'forget-ssh-workspace'
    | 'confirm-add-project-from-folder'
    | 'confirm-non-git-folder'
    | 'confirm-remove-folder'
    | 'add-repo'
    | 'quick-open'
    | 'worktree-palette'
    | 'workspace-cleanup'
    | 'project-added'
    | 'worktree-visibility'
    | 'new-workspace-composer'
    | 'confirm-orca-yaml-hooks'
  modalData: Record<string, unknown>
  openModal: (modal: UISliceContextual['activeModal'], data?: Record<string, unknown>) => void
  closeModal: () => void
  trustedOrcaHooks: PersistedTrustedOrcaHooks
  markOrcaHookScriptConfirmed: (
    repoId: string,
    kind: OrcaHookScriptKind,
    contentHash: string
  ) => void
  markOrcaHookRepoAlwaysTrusted: (repoId: string) => void
  clearOrcaHookTrustForRepo: (repoId: string) => void
  setupScriptPromptDismissedRepoIds: readonly string[]
  dismissSetupScriptPrompt: (repoHostIdentity: string) => void
  browserImportHintHidden: boolean
  setBrowserImportHintHidden: (hidden: boolean) => void
  mobileEmulatorTabIntroDismissed: boolean
  dismissMobileEmulatorTabIntro: () => void
  mobileEmulatorAgentSetupDismissed: boolean
  dismissMobileEmulatorAgentSetup: () => void
  projectOrderManualDefaultNoticeDismissed: boolean
  dismissProjectOrderManualDefaultNotice: () => void
  usagePercentageDisplayChangeNoticeDismissed: boolean
  dismissUsagePercentageDisplayChangeNotice: () => void
  usageEmptyStateDismissed: boolean
  dismissUsageEmptyState: () => void
}
