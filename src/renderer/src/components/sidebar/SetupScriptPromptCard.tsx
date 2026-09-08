import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { useMountedRef } from '@/hooks/useMountedRef'
import {
  buildImportedHookSettings,
  formatCandidateProvenance,
  formatCandidateSource,
  isSetupScriptPromptDismissed,
  ignoresSharedSetupScripts,
  inspectSetupScriptPromptState
} from '@/lib/setup-script-prompt'
import { checkRuntimeHooks, inspectRuntimeSetupScriptImports } from '@/runtime/runtime-hooks-client'
import { isGitRepoKind } from '../../../../shared/repo-kind'
import type { SetupScriptImportCandidate } from '../../../../shared/setup-script-imports'
import { SetupScriptPromptCardShell } from './SetupScriptPromptCardShell'
import { showSavedInProjectSettingsToast } from './SetupScriptPromptToast'
import { openSetupScriptSettings } from './open-setup-script-settings'
import {
  findSetupScriptPromptRepo,
  markSetupScriptPromptSaved,
  type SetupScriptPromptState
} from './setup-script-prompt-render-state'
import { useSetupScriptPromptRevalidation } from './useSetupScriptPromptRevalidation'
import { useRenderedSetupScriptPromptState } from './useRenderedSetupScriptPromptState'
import { translate } from '@/i18n/i18n'
import { getRepoHostIdentity } from '@/store/slices/repo-host-identity'
import { getRepoExecutionHostId } from '../../../../shared/execution-host'
import { useWorktreeById } from '@/store/selectors'

function SetupScriptPromptCard(): React.JSX.Element | null {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)
  const repos = useAppStore((s) => s.repos)
  const activeRepoId = useAppStore((s) => s.activeRepoId)
  const activeWorktreeId = useAppStore((s) => s.activeWorktreeId)
  const activeWorktree = useWorktreeById(activeWorktreeId)
  const settings = useAppStore((s) => s.settings)
  const updateRepo = useAppStore((s) => s.updateRepo)
  const openSettingsPage = useAppStore((s) => s.openSettingsPage)
  const openSettingsTarget = useAppStore((s) => s.openSettingsTarget)
  const setSettingsSearchQuery = useAppStore((s) => s.setSettingsSearchQuery)
  const dismissedRepoIds = useAppStore((s) => s.setupScriptPromptDismissedRepoIds)
  const dismissSetupScriptPrompt = useAppStore((s) => s.dismissSetupScriptPrompt)
  const [promptState, setPromptState] = useState<SetupScriptPromptState | null>(null)
  const [detectedSetupDraft, setDetectedSetupDraft] = useState('')
  const [importingRepoHostIdentity, setImportingRepoHostIdentity] = useState<string | null>(null)
  const [inspectionRetryKey, setInspectionRetryKey] = useState(0)
  const mountedRef = useMountedRef()

  const activeRepo = useMemo(
    () => findSetupScriptPromptRepo({ repos, activeRepoId, activeWorktree, settings }),
    [activeRepoId, activeWorktree, repos, settings]
  )
  const activeRepoHostIdentity = activeRepo ? getRepoHostIdentity(activeRepo) : null
  const isDismissed = activeRepoHostIdentity
    ? isSetupScriptPromptDismissed(activeRepoHostIdentity, dismissedRepoIds)
    : false

  useEffect(() => {
    if (!sidebarOpen || !activeRepo || !isGitRepoKind(activeRepo) || isDismissed) {
      setPromptState(null)
      setDetectedSetupDraft('')
      return
    }

    const repo = activeRepo
    let cancelled = false
    setPromptState(null)

    async function inspectRepoSetup(): Promise<void> {
      const hostId = getRepoExecutionHostId(repo)
      const inspection = await inspectSetupScriptPromptState({
        repo,
        checkHooks: () => checkRuntimeHooks(settings, repo.id, hostId),
        inspectImports: () => inspectRuntimeSetupScriptImports(settings, repo.id, hostId)
      })
      if (!cancelled) {
        const nextState = {
          ...inspection,
          repoHostIdentity: getRepoHostIdentity(repo)
        }
        setPromptState(nextState)
        setDetectedSetupDraft(
          nextState.status === 'ok' && nextState.candidate?.provider === 'package-manager'
            ? nextState.candidate.setup
            : ''
        )
      }
    }

    void inspectRepoSetup()

    return () => {
      cancelled = true
    }
  }, [activeRepo, inspectionRetryKey, isDismissed, settings, sidebarOpen])

  const openLocalCommandSettings = useCallback(
    (repoId: string, hostId: ReturnType<typeof getRepoExecutionHostId>) =>
      openSetupScriptSettings({
        repoId,
        hostId,
        setSettingsSearchQuery,
        openSettingsTarget,
        openSettingsPage
      }),
    [openSettingsPage, openSettingsTarget, setSettingsSearchQuery]
  )

  const handleRetryInspection = useCallback(() => {
    setInspectionRetryKey((value) => value + 1)
  }, [])

  useSetupScriptPromptRevalidation({
    activeRepo,
    isDismissed,
    sidebarOpen,
    promptState,
    requestRevalidation: handleRetryInspection
  })

  const handleConfigure = useCallback(() => {
    if (!activeRepo) {
      return
    }
    openLocalCommandSettings(activeRepo.id, getRepoExecutionHostId(activeRepo))
  }, [activeRepo, openLocalCommandSettings])

  const handleDismiss = useCallback(() => {
    if (activeRepo && activeRepoHostIdentity) {
      dismissSetupScriptPrompt(activeRepoHostIdentity)
    }
  }, [activeRepo, activeRepoHostIdentity, dismissSetupScriptPrompt])

  const saveSetupCandidate = useCallback(
    async (input: {
      candidate: SetupScriptImportCandidate
      hasSharedHooks: boolean
      actionPrefix: 'save_detected_setup' | 'import'
    }) => {
      const { candidate, hasSharedHooks, actionPrefix } = input
      if (!activeRepo) {
        return
      }
      const importedRepoHostIdentity = getRepoHostIdentity(activeRepo)
      const importedHostId = getRepoExecutionHostId(activeRepo)
      setImportingRepoHostIdentity(importedRepoHostIdentity)
      try {
        const importedRepoId = activeRepo.id
        const nextSettings = buildImportedHookSettings(activeRepo, candidate, hasSharedHooks)
        const didUpdate = await updateRepo(
          activeRepo.id,
          { hookSettings: nextSettings },
          { hostId: importedHostId }
        )
        if (!didUpdate) {
          if (mountedRef.current) {
            toast.error(
              translate(
                'auto.components.sidebar.SetupScriptPromptCard.888b83bf78',
                'Failed to save setup script'
              )
            )
          }
          return
        }
        if (actionPrefix === 'save_detected_setup') {
          if (mountedRef.current) {
            setPromptState((current) =>
              markSetupScriptPromptSaved(current, importedRepoHostIdentity)
            )
            showSavedInProjectSettingsToast({
              onOpenSettings: () => openLocalCommandSettings(importedRepoId, importedHostId),
              description: translate(
                'auto.components.sidebar.SetupScriptPromptCard.a49196d538',
                'Runs when Kondex creates a new worktree.'
              )
            })
          }
          return
        }
        if (mountedRef.current) {
          setPromptState((current) => markSetupScriptPromptSaved(current, importedRepoHostIdentity))
          const skippedCount = candidate.unsupportedFields?.length ?? 0
          showSavedInProjectSettingsToast({
            onOpenSettings: () => openLocalCommandSettings(importedRepoId, importedHostId),
            description:
              skippedCount > 0
                ? `${skippedCount} unsupported field${skippedCount === 1 ? '' : 's'} skipped. Saved the setup command.`
                : 'Saved the setup command.'
          })
        }
      } catch (error) {
        console.warn('[setup-script-prompt] Failed to save setup script:', error)
        if (mountedRef.current) {
          toast.error(
            translate(
              'auto.components.sidebar.SetupScriptPromptCard.888b83bf78',
              'Failed to save setup script'
            )
          )
        }
      } finally {
        if (mountedRef.current) {
          setImportingRepoHostIdentity((current) =>
            current === importedRepoHostIdentity ? null : current
          )
        }
      }
    },
    [activeRepo, mountedRef, openLocalCommandSettings, updateRepo]
  )

  const handleImport = useCallback(async () => {
    if (!activeRepo || promptState?.status !== 'ok' || !promptState.candidate) {
      return
    }
    const isPackageManagerCandidate = promptState.candidate.provider === 'package-manager'
    const actionPrefix = isPackageManagerCandidate ? 'save_detected_setup' : 'import'
    const candidate = isPackageManagerCandidate
      ? {
          ...promptState.candidate,
          setup: detectedSetupDraft.trim()
        }
      : promptState.candidate
    if (!candidate.setup) {
      toast.error(
        translate(
          'auto.components.sidebar.SetupScriptPromptCard.70715947fb',
          'Setup script cannot be empty'
        )
      )
      return
    }
    await saveSetupCandidate({
      candidate,
      hasSharedHooks: promptState.hasSharedHooks,
      actionPrefix
    })
  }, [activeRepo, detectedSetupDraft, promptState, saveSetupCandidate])

  const promptTargetHidden =
    !sidebarOpen ||
    !activeRepo ||
    !activeRepoHostIdentity ||
    !isGitRepoKind(activeRepo) ||
    isDismissed
  const renderedPromptState = useRenderedSetupScriptPromptState({
    promptState,
    activeRepoId: activeRepo?.id ?? null,
    activeRepoHostIdentity,
    promptTargetHidden
  })

  if (
    promptTargetHidden ||
    !activeRepo ||
    !renderedPromptState ||
    (renderedPromptState.status === 'ok' && renderedPromptState.hasEffectiveSetup)
  ) {
    return null
  }

  // Why: a forbidden (mobile-scope) inspection is permanent, so suppress the
  // retry-able card entirely — the global scope-mismatch banner explains it and
  // a retry would just re-fire repo.hooksCheck on every repo focus.
  if (renderedPromptState.status === 'forbidden') {
    return null
  }

  const isInspectionError = renderedPromptState.status === 'error'
  const candidate = renderedPromptState.status === 'ok' ? renderedPromptState.candidate : null
  const isPackageManagerSuggestion = candidate?.provider === 'package-manager'
  const sharedSetupIgnored =
    renderedPromptState.status === 'ok' &&
    candidate === null &&
    ignoresSharedSetupScripts(activeRepo)
  const candidateSource = candidate ? formatCandidateSource(candidate) : null
  const candidateProvenance = candidate ? formatCandidateProvenance(candidate) : null

  return (
    <SetupScriptPromptCardShell
      repoBadgeColor={activeRepo.badgeColor}
      repoDisplayName={activeRepo.displayName}
      isInspectionError={isInspectionError}
      sharedSetupIgnored={sharedSetupIgnored}
      isPackageManagerSuggestion={Boolean(isPackageManagerSuggestion && candidate)}
      hasCandidate={Boolean(candidate)}
      candidateSource={candidateSource}
      candidateProvenance={candidateProvenance}
      detectedSetupDraft={detectedSetupDraft}
      isImporting={importingRepoHostIdentity === activeRepoHostIdentity}
      renderedStateOk={renderedPromptState.status === 'ok'}
      onDismiss={handleDismiss}
      onRetryInspection={handleRetryInspection}
      onConfigure={handleConfigure}
      onImport={() => void handleImport()}
      onSetupDraftChange={setDetectedSetupDraft}
    />
  )
}

export default React.memo(SetupScriptPromptCard)
