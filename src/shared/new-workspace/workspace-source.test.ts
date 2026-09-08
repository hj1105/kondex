import { describe, expect, it } from 'vitest'
import {
  buildWorkspaceSourceSelection,
  getWorkspaceSourceProvider,
  shouldApplyWorkspaceSourceAutoName,
  shouldPreserveWorkspaceSourceOnRepoChange
} from './workspace-source'

describe('workspace source policy', () => {
  it('clears repo-scoped work items when the repo changes', () => {
    expect(
      shouldPreserveWorkspaceSourceOnRepoChange({
        provider: 'github',
        type: 'issue',
        number: 1,
        title: 'Repo scoped',
        url: 'https://github.com/o/r/issues/1'
      })
    ).toBe(false)
    // Why: GitLab is repo-scoped; pin both the explicit MR and the
    // URL-inferred shape clear, since folder-source/project-group paths delegate here.
    expect(
      shouldPreserveWorkspaceSourceOnRepoChange({
        provider: 'gitlab',
        type: 'mr',
        number: 2,
        title: 'Repo scoped MR',
        url: 'https://gitlab.com/o/r/-/merge_requests/2'
      })
    ).toBe(false)
    expect(
      shouldPreserveWorkspaceSourceOnRepoChange({
        type: 'issue',
        number: 3,
        title: 'Inferred GitLab',
        url: 'https://gitlab.example.com/g/p/-/work_items/3'
      })
    ).toBe(false)
    // Why: a null source (branch-only) has nothing to preserve; callers guard on this.
    expect(shouldPreserveWorkspaceSourceOnRepoChange(null)).toBe(false)
  })

  it('shares provider inference, selection labels, and auto-name gates', () => {
    const legacyGitLab = {
      type: 'issue' as const,
      number: 7,
      title: 'Self hosted',
      url: 'https://gitlab.example.com/g/p/-/work_items/7'
    }
    expect(getWorkspaceSourceProvider(legacyGitLab)).toBe('gitlab')
    expect(buildWorkspaceSourceSelection({ linkedWorkItem: legacyGitLab })).toMatchObject({
      kind: 'gitlab-issue',
      label: '#7 Self hosted'
    })
    expect(shouldApplyWorkspaceSourceAutoName({ currentName: '#42', lastAutoName: 'old' })).toBe(
      true
    )
    expect(
      shouldApplyWorkspaceSourceAutoName({ currentName: 'my workspace', lastAutoName: 'old' })
    ).toBe(false)
  })
})
