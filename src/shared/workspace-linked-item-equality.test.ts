import { describe, expect, it } from 'vitest'
import { areWorkspaceLinkedItemsEqual } from './workspace-linked-item'
import type { WorkspaceLinkedItem } from './worktree/types'

const item: WorkspaceLinkedItem = {
  provider: 'gitlab',
  type: 'issue',
  number: 123,
  title: 'Link GitLab',
  url: 'https://gitlab.com/acme/app/-/issues/123',
  repoId: 'repo-1'
}

describe('areWorkspaceLinkedItemsEqual', () => {
  it('ignores key order and absent-vs-undefined optional fields', () => {
    expect(
      areWorkspaceLinkedItemsEqual(item, {
        repoId: 'repo-1',
        url: 'https://gitlab.com/acme/app/-/issues/123',
        title: 'Link GitLab',
        number: 123,
        type: 'issue',
        provider: 'gitlab'
      })
    ).toBe(true)
    const { repoId: _repoId, ...withoutRepo } = item
    expect(areWorkspaceLinkedItemsEqual(withoutRepo, { ...withoutRepo, repoId: undefined })).toBe(
      true
    )
  })

  it('treats both nullish items as equal and a one-sided item as different', () => {
    expect(areWorkspaceLinkedItemsEqual(null, undefined)).toBe(true)
    expect(areWorkspaceLinkedItemsEqual(item, null)).toBe(false)
  })

  it('separates items that differ by identifier, title, url, provider, or repo', () => {
    expect(areWorkspaceLinkedItemsEqual(item, { ...item, number: 124 })).toBe(false)
    expect(areWorkspaceLinkedItemsEqual(item, { ...item, title: 'Renamed' })).toBe(false)
    expect(areWorkspaceLinkedItemsEqual(item, { ...item, url: 'https://other/browse/X-1' })).toBe(
      false
    )
    expect(areWorkspaceLinkedItemsEqual(item, { ...item, provider: 'github', number: 12 })).toBe(
      false
    )
    expect(areWorkspaceLinkedItemsEqual(item, { ...item, repoId: 'repo-2' })).toBe(false)
  })
})
