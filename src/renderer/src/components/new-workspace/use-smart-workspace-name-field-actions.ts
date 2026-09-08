import { useCallback } from 'react'
import type React from 'react'
import { lookupGitHubWorkItemByOwnerRepoForSource } from '@/lib/github-work-item-source-lookup'
import {
  applyWorkspaceEmojiSuggestion,
  type WorkspaceEmojiReplacement,
  type WorkspaceEmojiSuggestion
} from '@/lib/workspace-emoji-shortcodes'
import type { GitHubWorkItem } from '../../../../shared/github/work-item-types'
import { buildTaskSourceContextFromRepo } from '../../../../shared/task-source-context'
import type { RepoOption, RowEntry } from './smart-workspace-name-field-model'
import { getRepoSlugCached, sameSlug } from './smart-workspace-repo-slug'
import type { useSmartWorkspaceNameFieldFoundation } from './use-smart-workspace-name-field-foundation'
import type { useSmartWorkspaceNameFieldPresentation } from './use-smart-workspace-name-field-presentation'

type Foundation = ReturnType<typeof useSmartWorkspaceNameFieldFoundation>
type Presentation = ReturnType<typeof useSmartWorkspaceNameFieldPresentation>

function scheduleEmojiInputFocus(
  frameRef: React.RefObject<number | null>,
  inputRef: React.RefObject<HTMLInputElement | null>,
  replacement: WorkspaceEmojiReplacement
): void {
  frameRef.current = requestAnimationFrame(() => {
    frameRef.current = null
    inputRef.current?.focus({ preventScroll: true })
    inputRef.current?.setSelectionRange(replacement.cursor, replacement.cursor)
  })
}

export function useSmartWorkspaceNameFieldActions(
  foundation: Foundation,
  presentation: Presentation
) {
  const {
    onBranchSelect,
    onGitHubItemSelect,
    onGitLabItemSelect,
    onValueChange,
    setOpen,
    selectedSource,
    setEmojiCursor,
    cancelLocalInputFocusFrame,
    localInputFocusFrameRef,
    localInputRef,
    value,
    crossRepoPrompt,
    handledCrossRepoUrlRef,
    debouncedQuery,
    setGithubLoading,
    onRepoChange,
    setCrossRepoPrompt,
    selectedRepo,
    allowCrossRepoProjectAdd,
    addRepo,
    repoSlugCacheRef
  } = foundation
  const { activeEmojiShortcode } = presentation

  const handleSelect = useCallback(
    (row: RowEntry) => {
      // Why: held rows remain selectable while the live query leads debounce.
      if (row.kind === 'use-name' || row.kind === 'create-branch') {
        onValueChange(row.name)
      } else if (row.kind === 'github') {
        onGitHubItemSelect(row.item)
      } else if (row.kind === 'gitlab') {
        onGitLabItemSelect?.(row.item)
      } else if (row.kind === 'branch') {
        onBranchSelect(row.refName, row.localBranchName)
      }
      setOpen(false)
    },
    [onBranchSelect, onGitHubItemSelect, onGitLabItemSelect, onValueChange, setOpen]
  )
  const openSelectedSource = useCallback((): void => {
    if (selectedSource?.url) {
      void window.api.shell.openUrl(selectedSource.url)
    }
  }, [selectedSource?.url])
  const applyEmojiReplacement = useCallback(
    (replacement: WorkspaceEmojiReplacement): void => {
      onValueChange(replacement.value)
      setEmojiCursor(null)
      cancelLocalInputFocusFrame()
      scheduleEmojiInputFocus(localInputFocusFrameRef, localInputRef, replacement)
    },
    [
      cancelLocalInputFocusFrame,
      localInputFocusFrameRef,
      localInputRef,
      onValueChange,
      setEmojiCursor
    ]
  )
  const handleEmojiSelect = useCallback(
    (suggestion: WorkspaceEmojiSuggestion): void => {
      if (!activeEmojiShortcode) {
        return
      }
      applyEmojiReplacement(applyWorkspaceEmojiSuggestion(value, activeEmojiShortcode, suggestion))
    },
    [activeEmojiShortcode, applyEmojiReplacement, value]
  )
  const acceptGitHubLink = useCallback(
    async (targetRepo: RepoOption): Promise<void> => {
      if (!crossRepoPrompt) {
        return
      }
      handledCrossRepoUrlRef.current = debouncedQuery.trim()
      setGithubLoading(true)
      try {
        const sourceContext = buildTaskSourceContextFromRepo({
          provider: 'github',
          projectId: targetRepo.id,
          repo: targetRepo
        })
        const item = await lookupGitHubWorkItemByOwnerRepoForSource({
          repoPath: targetRepo.path,
          repoId: targetRepo.id,
          sourceContext,
          owner: crossRepoPrompt.link.slug.owner,
          repo: crossRepoPrompt.link.slug.repo,
          ...(crossRepoPrompt.link.slug.host ? { host: crossRepoPrompt.link.slug.host } : {}),
          number: crossRepoPrompt.link.number,
          type: crossRepoPrompt.link.type
        })
        if (!item) {
          return
        }
        onRepoChange(targetRepo.id)
        onGitHubItemSelect({ ...item, repoId: targetRepo.id } as GitHubWorkItem)
        setOpen(false)
        setCrossRepoPrompt(null)
      } finally {
        setGithubLoading(false)
      }
    },
    [
      crossRepoPrompt,
      debouncedQuery,
      handledCrossRepoUrlRef,
      onGitHubItemSelect,
      onRepoChange,
      setCrossRepoPrompt,
      setGithubLoading,
      setOpen
    ]
  )
  const handleUseCurrentRepo = useCallback(async (): Promise<void> => {
    if (!selectedRepo) {
      return
    }
    setCrossRepoPrompt(null)
    await acceptGitHubLink(selectedRepo)
  }, [acceptGitHubLink, selectedRepo, setCrossRepoPrompt])
  const handleAddMatchingRepo = useCallback(async (): Promise<void> => {
    if (!crossRepoPrompt || !allowCrossRepoProjectAdd) {
      return
    }
    const added = await addRepo()
    if (!added) {
      return
    }
    const sourceContext = buildTaskSourceContextFromRepo({
      provider: 'github',
      projectId: added.id,
      repo: added
    })
    const slug = await getRepoSlugCached(added, sourceContext, repoSlugCacheRef.current)
    if (slug && sameSlug(slug, crossRepoPrompt.link.slug)) {
      await acceptGitHubLink(added)
    }
  }, [acceptGitHubLink, addRepo, allowCrossRepoProjectAdd, crossRepoPrompt, repoSlugCacheRef])
  const dismissCrossRepoPrompt = useCallback((): void => {
    handledCrossRepoUrlRef.current = debouncedQuery.trim()
    setCrossRepoPrompt(null)
  }, [debouncedQuery, handledCrossRepoUrlRef, setCrossRepoPrompt])

  return {
    handleSelect,
    openSelectedSource,
    applyEmojiReplacement,
    handleEmojiSelect,
    acceptGitHubLink,
    handleUseCurrentRepo,
    handleAddMatchingRepo,
    dismissCrossRepoPrompt
  }
}
