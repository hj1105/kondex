import type { GlobalSettings } from '../../../shared/global-settings-types'
import type { PersistedState } from '../../../shared/persisted-state-types'
import type { ProjectGroup } from '../../../shared/project-group-types'
import { deriveGlobalWindowsRuntimeDefaultFromLegacySettings } from '../../../shared/project-execution-runtime'
import { normalizeAutoRenameBranchFromWorkDefaultOn } from '../../../shared/auto-rename-branch-from-work-settings'
import { normalizeSourceControlGroupOrder } from '../../../shared/source-control-group-order'
import { normalizeProjectGroups } from '../../../shared/project-groups'
import { normalizeDisabledTuiAgents } from '../../../shared/tui-agent-selection'
import { normalizeTerminalCursorStyleDefault } from '../../../shared/terminal-cursor-style-settings'
import { normalizeTerminalLineHeight } from '../../../shared/terminal-line-height-settings'
import { migrateAgentYoloDefaults } from '../applying-settings/terminal-settings-migrations'
import {
  normalizeLoadedOnboardingState,
  normalizeNotificationSettings,
  persistedNotificationSettingsRepaired
} from '../applying-settings/onboarding-normalization'

export type PreparedLoadedProfileSettings = {
  migratedExperimentalActivity: GlobalSettings['experimentalActivity']
  migratedAutoRenameBranchFromWork: Pick<
    GlobalSettings,
    'autoRenameBranchFromWork' | 'autoRenameBranchFromWorkDefaultedOn'
  >
  migratedTerminalCursorStyle: Pick<
    GlobalSettings,
    'terminalCursorStyle' | 'terminalCursorStyleDefaultedToBlock'
  >
  migratedTerminalLineHeight: GlobalSettings['terminalLineHeight']
  terminalRightClickToPasteDefaultedForPlatform: boolean
  primarySelectionDefaultedForLinux: boolean
  primarySelectionDefaultedForTerminalDefaults: boolean
  migratePrimarySelectionPlatformDefault: boolean
  stampPrimarySelectionTerminalDefaults: boolean
  migratedDisabledTuiAgents: GlobalSettings['disabledTuiAgents']
  migratedAgentYoloDefaults: Pick<
    GlobalSettings,
    'agentDefaultArgs' | 'agentDefaultEnv' | 'agentYoloDefaultsMigrated'
  >
  migratedWindowsRuntimeDefault: GlobalSettings['localWindowsRuntimeDefault']
  migratedLocalAccountRuntime: GlobalSettings['localAccountRuntime']
  loadedCompactWorktreeCards: boolean
  normalizedNotifications: GlobalSettings['notifications']
  normalizedSourceControlGroupOrder: GlobalSettings['sourceControlGroupOrder']
  normalizedOnboarding: PersistedState['onboarding']
  normalizedProjectGroups: ProjectGroup[]
}

export function prepareLoadedProfileSettings(
  parsed: PersistedState,
  defaults: PersistedState,
  markNeedsSave: () => void
): PreparedLoadedProfileSettings {
  const experimentalActivityDefaultedOffForAllUsers =
    parsed.settings?.experimentalActivityDefaultedOffForAllUsers === true
  // Why: preserve the legacy rollout boundary while loading profiles created before the Agents tab graduated.
  const migratedExperimentalActivity = experimentalActivityDefaultedOffForAllUsers
    ? (parsed.settings?.experimentalActivity ?? false)
    : false
  const autoRenameBranchFromWorkDefaultedOn =
    parsed.settings?.autoRenameBranchFromWorkDefaultedOn === true
  // Why: default-on rollout activates old profiles once, but a later Settings opt-out survives reloads.
  const migratedAutoRenameBranchFromWork = normalizeAutoRenameBranchFromWorkDefaultOn(
    parsed.settings
  )
  const migratedTerminalCursorStyle = normalizeTerminalCursorStyleDefault(parsed.settings)
  if (
    parsed.settings?.terminalCursorStyle !== migratedTerminalCursorStyle.terminalCursorStyle ||
    parsed.settings?.terminalCursorStyleDefaultedToBlock !== true
  ) {
    markNeedsSave()
  }
  const migratedTerminalLineHeight = normalizeTerminalLineHeight(
    parsed.settings?.terminalLineHeight
  )
  const terminalRightClickToPasteDefaultedForPlatform =
    parsed.settings?.terminalRightClickToPasteDefaultedForPlatform === true
  if (!terminalRightClickToPasteDefaultedForPlatform) {
    markNeedsSave()
  }
  if (
    parsed.settings?.terminalLineHeight !== undefined &&
    parsed.settings.terminalLineHeight !== migratedTerminalLineHeight
  ) {
    markNeedsSave()
  }
  const retiredTaskSettings = parsed.settings as
    | (GlobalSettings & {
        defaultTaskViewPreset?: unknown
        defaultTaskSource?: unknown
        visibleTaskProviders?: unknown
        visibleTaskProvidersDefaultedForJira?: unknown
        defaultRepoSelection?: unknown
        defaultLinearTeamSelection?: unknown
      })
    | undefined
  if (
    retiredTaskSettings &&
    [
      'defaultTaskViewPreset',
      'defaultTaskSource',
      'visibleTaskProviders',
      'visibleTaskProvidersDefaultedForJira',
      'defaultRepoSelection',
      'defaultLinearTeamSelection'
    ].some((key) => Object.hasOwn(retiredTaskSettings, key))
  ) {
    markNeedsSave()
  }
  const primarySelectionDefaultedForLinux =
    parsed.settings?.primarySelectionMiddleClickPasteDefaultedForLinux === true
  const primarySelectionDefaultedForTerminalDefaults =
    parsed.settings?.primarySelectionMiddleClickPasteDefaultedForTerminalDefaults === true
  const primarySelectionPlatformDefaultEnabled =
    defaults.settings.primarySelectionMiddleClickPaste === true
  const primarySelectionAlreadyDefaultedForPlatform =
    primarySelectionDefaultedForTerminalDefaults ||
    (process.platform === 'linux' && primarySelectionDefaultedForLinux)
  const migratePrimarySelectionPlatformDefault =
    primarySelectionPlatformDefaultEnabled && !primarySelectionAlreadyDefaultedForPlatform
  const stampPrimarySelectionTerminalDefaults =
    primarySelectionPlatformDefaultEnabled && !primarySelectionDefaultedForTerminalDefaults
  if (migratePrimarySelectionPlatformDefault || stampPrimarySelectionTerminalDefaults) {
    markNeedsSave()
  }
  const migratedDisabledTuiAgents = normalizeDisabledTuiAgents(parsed.settings?.disabledTuiAgents)
  const migratedAgentYoloDefaults = migrateAgentYoloDefaults(parsed.settings)
  if (parsed.settings?.agentYoloDefaultsMigrated !== true) {
    markNeedsSave()
  }
  const migratedWindowsRuntimeDefault =
    parsed.settings?.localWindowsRuntimeDefault === undefined
      ? deriveGlobalWindowsRuntimeDefaultFromLegacySettings(parsed.settings).defaultRuntime
      : parsed.settings.localWindowsRuntimeDefault
  if (
    parsed.settings?.localWindowsRuntimeDefault === undefined &&
    migratedWindowsRuntimeDefault.kind === 'wsl'
  ) {
    markNeedsSave()
  }
  // Why (#9537): migrate the indistinguishable legacy host default once so WSL-default users follow their runtime.
  const localAccountRuntimeAlreadyMigrated =
    parsed.settings?.localAccountRuntimeDefaultedToAutoForAllUsers === true
  const migratedLocalAccountRuntime: GlobalSettings['localAccountRuntime'] =
    localAccountRuntimeAlreadyMigrated
      ? (parsed.settings?.localAccountRuntime ?? defaults.settings.localAccountRuntime)
      : parsed.settings?.localAccountRuntime === 'wsl'
        ? 'wsl'
        : 'auto'
  if (!localAccountRuntimeAlreadyMigrated) {
    markNeedsSave()
  }
  if (!autoRenameBranchFromWorkDefaultedOn) {
    markNeedsSave()
  }
  const normalizedOnboarding = normalizeLoadedOnboardingState(
    parsed.onboarding,
    defaults.onboarding
  )
  if (!parsed.onboarding) {
    markNeedsSave()
  }
  const normalizedProjectGroups = normalizeProjectGroups(parsed.projectGroups)
  const loadedCompactWorktreeCards =
    parsed.settings?.compactWorktreeCards ??
    parsed.settings?.experimentalCompactWorktreeCards ??
    defaults.settings.compactWorktreeCards
  const normalizedNotifications = normalizeNotificationSettings(parsed.settings?.notifications)
  // Why: a type-flipped notification field is repaired in memory only; without a dirty mark the
  // bad value stays on disk and the repair reruns on every launch.
  if (
    persistedNotificationSettingsRepaired(parsed.settings?.notifications, normalizedNotifications)
  ) {
    markNeedsSave()
  }
  const normalizedSourceControlGroupOrder = normalizeSourceControlGroupOrder(
    parsed.settings?.sourceControlGroupOrder
  )
  if (
    parsed.settings?.sourceControlGroupOrder !== undefined &&
    parsed.settings.sourceControlGroupOrder !== normalizedSourceControlGroupOrder
  ) {
    markNeedsSave()
  }
  return {
    migratedExperimentalActivity,
    migratedAutoRenameBranchFromWork,
    migratedTerminalCursorStyle,
    migratedTerminalLineHeight,
    terminalRightClickToPasteDefaultedForPlatform,
    primarySelectionDefaultedForLinux,
    primarySelectionDefaultedForTerminalDefaults,
    migratePrimarySelectionPlatformDefault,
    stampPrimarySelectionTerminalDefaults,
    migratedDisabledTuiAgents,
    migratedAgentYoloDefaults,
    migratedWindowsRuntimeDefault,
    migratedLocalAccountRuntime,
    loadedCompactWorktreeCards,
    normalizedNotifications,
    normalizedSourceControlGroupOrder,
    normalizedOnboarding,
    normalizedProjectGroups
  }
}
