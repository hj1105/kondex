import React, { useCallback } from 'react'
import { toast } from 'sonner'

import { translate } from '@/i18n/i18n'
import { openWorkspaceBrowserTab } from '@/lib/workspace-browser-tab-open'
import { hasWorktreeCardDetails } from './WorktreeCardMeta'
import { usePromptCacheCountdownStartedAt } from './CacheTimer'
import { useWorktreeAgentRows } from './useWorktreeAgentRows'
import type { WorktreeCardProps } from './worktree-card-model'
import type { useWorktreeCardFoundation } from './use-worktree-card-foundation'
import type { useWorktreeCardLinkedDetails } from './use-worktree-card-linked-details'
import type { useWorktreeCardReviewDetails } from './use-worktree-card-review-details'

type Foundation = ReturnType<typeof useWorktreeCardFoundation>
type LinkedDetails = ReturnType<typeof useWorktreeCardLinkedDetails>
type ReviewDetails = ReturnType<typeof useWorktreeCardReviewDetails>

export function useWorktreeCardSecondaryDetails({
  worktree,
  repo,
  statusPrDisplay,
  showStatus,
  showIssue,
  showPR,
  showAutomation,
  showCli,
  showComment,
  showPorts,
  issueDisplay,
  prDisplay,
  linkedGitLabMR,
  linkedBitbucketPR,
  linkedAzureDevOpsPR,
  linkedGiteaPR,
  cardProps,
  newCardStyle,
  compactCards,
  agentActivityDisplayMode,
  workspacePorts,
  updateWorktreeMeta,
  settings
}: Pick<WorktreeCardProps, 'worktree' | 'repo' | 'statusPrDisplay'> &
  Pick<
    Foundation,
    | 'cardProps'
    | 'newCardStyle'
    | 'compactCards'
    | 'agentActivityDisplayMode'
    | 'workspacePorts'
    | 'openTaskPage'
    | 'updateWorktreeMeta'
    | 'settings'
  > &
  Pick<LinkedDetails, 'issueDisplay'> &
  Pick<
    ReviewDetails,
    'prDisplay' | 'linkedGitLabMR' | 'linkedBitbucketPR' | 'linkedAzureDevOpsPR' | 'linkedGiteaPR'
  > & {
    showStatus: boolean
    showIssue: boolean
    showPR: boolean
    showAutomation: boolean
    showCli: boolean
    showComment: boolean
    showPorts: boolean
  }) {
  // Why: unread lives in the left status lane, so the Status toggle owns both the dot/PR slot and unread emphasis.
  const showUnreadEmphasis = showStatus && worktree.isUnread
  const hoverIssue = issueDisplay
  const hoverReview = prDisplay
  const statusLaneReview = statusPrDisplay ?? hoverReview
  const hoverComment = worktree.comment
  const metaIssue = showIssue ? hoverIssue : null
  const metaReview = showPR ? hoverReview : null
  const metaAutomationProvenance = showAutomation ? worktree.automationProvenance : null
  const metaCliProvenance = showCli ? worktree.cliProvenance : null
  const metaComment = showComment ? hoverComment : null
  const showInlineAgentList = cardProps.includes('inline-agents') && (newCardStyle || !compactCards)
  const compactInlineAgentRows = useWorktreeAgentRows(
    worktree.id,
    showInlineAgentList && agentActivityDisplayMode === 'compact'
  )
  const compactInlineAgentRowsVisible =
    showInlineAgentList &&
    agentActivityDisplayMode === 'compact' &&
    compactInlineAgentRows.length > 0
  const showAggregateCacheTimer = !compactCards && !compactInlineAgentRowsVisible
  const openLinkedUrlInBrowser = useCallback(
    (url: string): void => {
      void openWorkspaceBrowserTab({
        workspaceId: worktree.id,
        url,
        intent: { kind: 'url' }
      }).catch((error: unknown) => {
        toast.error(
          error instanceof Error
            ? error.message
            : translate('auto.lib.workspace.browser.tab.open.urlFailed', 'Unable to open URL.')
        )
      })
    },
    [worktree.id]
  )
  const handleOpenIssueInBrowser = useCallback(
    (url: string): void => {
      openLinkedUrlInBrowser(url)
    },
    [openLinkedUrlInBrowser]
  )
  const handleOpenGitHubIssueInOrca = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation()
      const url = hoverIssue && 'url' in hoverIssue ? hoverIssue.url : undefined
      if (repo && url) {
        openLinkedUrlInBrowser(url)
      }
    },
    [hoverIssue, openLinkedUrlInBrowser, repo]
  )
  const handleOpenReviewInOrca = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation()
      if (repo && hoverReview?.url) {
        openLinkedUrlInBrowser(hoverReview.url)
      }
    },
    [hoverReview, openLinkedUrlInBrowser, repo]
  )
  const handleOpenReviewInBrowser = useCallback(
    (url: string): void => {
      openLinkedUrlInBrowser(url)
    },
    [openLinkedUrlInBrowser]
  )
  const hoverReviewProvider = hoverReview?.provider
  const canUnlinkReview =
    hoverReviewProvider === 'github' ||
    (hoverReviewProvider === 'gitlab' && linkedGitLabMR !== null) ||
    (hoverReviewProvider === 'bitbucket' && linkedBitbucketPR !== null) ||
    (hoverReviewProvider === 'azure-devops' && linkedAzureDevOpsPR !== null) ||
    (hoverReviewProvider === 'gitea' && linkedGiteaPR !== null)
  const hasExplicitLinkedReview =
    (hoverReviewProvider === 'github' && worktree.linkedPR !== null) ||
    (hoverReviewProvider === 'gitlab' && linkedGitLabMR !== null) ||
    (hoverReviewProvider === 'bitbucket' && linkedBitbucketPR !== null) ||
    (hoverReviewProvider === 'azure-devops' && linkedAzureDevOpsPR !== null) ||
    (hoverReviewProvider === 'gitea' && linkedGiteaPR !== null)
  const handleUnlinkReview = useCallback(async () => {
    const options = { executionHostId: worktree.hostId ?? 'local' }
    switch (hoverReviewProvider) {
      case 'github':
        if (hoverReview) {
          const result = await updateWorktreeMeta(
            worktree.id,
            { linkedPR: null, suppressedGitHubPR: hoverReview.number },
            options
          )
          if (!result.ok) {
            toast.error(result.error)
          }
        }
        return
      case 'gitlab':
        void updateWorktreeMeta(worktree.id, { linkedGitLabMR: null }, options)
        return
      case 'bitbucket':
        void updateWorktreeMeta(worktree.id, { linkedBitbucketPR: null }, options)
        return
      case 'azure-devops':
        void updateWorktreeMeta(worktree.id, { linkedAzureDevOpsPR: null }, options)
        return
      case 'gitea':
        void updateWorktreeMeta(worktree.id, { linkedGiteaPR: null }, options)
        break
      case 'unsupported':
      case undefined:
        break
    }
  }, [hoverReview, hoverReviewProvider, updateWorktreeMeta, worktree.hostId, worktree.id])
  const hasDetails = hasWorktreeCardDetails({
    issue: metaIssue,
    review: newCardStyle ? null : metaReview,
    comment: metaComment,
    automationProvenance: metaAutomationProvenance,
    cliProvenance: metaCliProvenance
  })
  const hasPorts = showPorts && workspacePorts.length > 0
  const cacheStartedAt = usePromptCacheCountdownStartedAt(worktree.id, showAggregateCacheTimer)
  // Why: derived from the settings the card already subscribes to — a third store
  // subscription for this one field costs a listener per card on every store write.
  const cacheTtlMs = showAggregateCacheTimer ? (settings?.promptCacheTtlMs ?? 0) : 0

  return {
    showUnreadEmphasis,
    hoverIssue,
    hoverReview,
    statusLaneReview,
    hoverComment,
    metaIssue,
    metaReview,
    metaAutomationProvenance,
    metaCliProvenance,
    metaComment,
    showInlineAgentList,
    compactInlineAgentRows,
    handleOpenGitHubIssueInOrca,
    handleOpenIssueInBrowser,
    handleOpenReviewInOrca,
    canUnlinkReview,
    handleOpenReviewInBrowser,
    hasExplicitLinkedReview,
    handleUnlinkReview,
    hasDetails,
    hasPorts,
    cacheStartedAt,
    cacheTtlMs
  }
}
