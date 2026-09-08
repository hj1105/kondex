import { useCallback, useMemo } from 'react'
import type { ComposerModel } from './composer-model'
import { getSmartNameSelection as getFolderSmartNameSelection } from '@/components/sidebar/folder-workspace-composer-helpers'
import { buildWorkspaceSourceSelection } from '../../../../shared/new-workspace/workspace-source'
import type { SmartWorkspaceNameSelection } from '@/components/new-workspace/SmartWorkspaceNameField'

type IssueSourceActionsInput = Pick<
  ComposerModel,
  | 'baseBranch'
  | 'branchAutoNameRef'
  | 'isProjectGroupTarget'
  | 'lastAutoNameRef'
  | 'lastAutoNoteRef'
  | 'linkedWorkItem'
  | 'name'
  | 'noteRef'
  | 'setBaseBranch'
  | 'setBranchNameOverride'
  | 'setBranchNameOverridePreservesNameEdits'
  | 'setCompareBaseRef'
  | 'setForkPushWarning'
  | 'setLinkedGitLabIssue'
  | 'setLinkedGitLabMR'
  | 'setLinkedIssue'
  | 'setLinkedPR'
  | 'setLinkedTaskSourceContext'
  | 'setLinkedWorkItem'
  | 'setName'
  | 'setNote'
  | 'setPushTarget'
  | 'setReuseEligibleBranch'
  | 'setReuseSelectedBranch'
  | 'setStartFromResetHint'
  | 'smartGitHubPrStartPointSelectionRef'
>

export function useIssueSourceActions(input: IssueSourceActionsInput) {
  const {
    baseBranch,
    branchAutoNameRef,
    isProjectGroupTarget,
    lastAutoNameRef,
    lastAutoNoteRef,
    linkedWorkItem,
    name,
    noteRef,
    setBaseBranch,
    setBranchNameOverride,
    setBranchNameOverridePreservesNameEdits,
    setCompareBaseRef,
    setForkPushWarning,
    setLinkedGitLabIssue,
    setLinkedGitLabMR,
    setLinkedIssue,
    setLinkedPR,
    setLinkedTaskSourceContext,
    setLinkedWorkItem,
    setName,
    setNote,
    setPushTarget,
    setReuseEligibleBranch,
    setReuseSelectedBranch,
    setStartFromResetHint,
    smartGitHubPrStartPointSelectionRef
  } = input

  const handleClearSmartNameSelection = useCallback((): void => {
    smartGitHubPrStartPointSelectionRef.current = null
    setLinkedIssue('')
    setLinkedPR(null)
    setLinkedGitLabIssue(null)
    setLinkedGitLabMR(null)
    setLinkedWorkItem(null)
    setLinkedTaskSourceContext(null)
    setBaseBranch(undefined)
    setCompareBaseRef(undefined)
    setPushTarget(undefined)
    setBranchNameOverride(undefined)
    setBranchNameOverridePreservesNameEdits(false)
    setReuseEligibleBranch(null)
    setReuseSelectedBranch(false)
    setForkPushWarning(null)
    branchAutoNameRef.current = ''
    setStartFromResetHint(null)
    if (name === lastAutoNameRef.current) {
      setName('')
      lastAutoNameRef.current = ''
    }
    if (noteRef.current === lastAutoNoteRef.current) {
      setNote('')
      lastAutoNoteRef.current = ''
    }
  }, [
    name,
    branchAutoNameRef,
    lastAutoNameRef,
    lastAutoNoteRef,
    noteRef,
    setBaseBranch,
    setBranchNameOverride,
    setBranchNameOverridePreservesNameEdits,
    setCompareBaseRef,
    setForkPushWarning,
    setLinkedGitLabIssue,
    setLinkedGitLabMR,
    setLinkedIssue,
    setLinkedPR,
    setLinkedTaskSourceContext,
    setLinkedWorkItem,
    setName,
    setNote,
    setPushTarget,
    setReuseEligibleBranch,
    setReuseSelectedBranch,
    setStartFromResetHint,
    smartGitHubPrStartPointSelectionRef
  ])

  const smartNameSelection = useMemo<SmartWorkspaceNameSelection | null>(() => {
    if (isProjectGroupTarget) return getFolderSmartNameSelection(linkedWorkItem)
    return buildWorkspaceSourceSelection({
      linkedWorkItem,
      baseBranch
    }) as SmartWorkspaceNameSelection | null
  }, [baseBranch, isProjectGroupTarget, linkedWorkItem])

  return { handleClearSmartNameSelection, smartNameSelection }
}
