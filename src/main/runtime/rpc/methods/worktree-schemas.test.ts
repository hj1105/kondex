import { describe, expect, it } from 'vitest'
import { WorktreeCreate } from './worktree-create-schemas'
import { WorktreeActivate, WorktreeSet } from './worktree-schemas'

describe('worktree RPC schemas', () => {
  it('accepts optional display-name provenance values', () => {
    expect(
      WorktreeCreate.parse({ repo: 'repo-1', name: 'feature', displayNameKind: 'user' })
    ).toMatchObject({ displayNameKind: 'user' })
    expect(
      WorktreeCreate.parse({ repo: 'repo-1', name: 'feature', displayNameKind: 'generated' })
    ).toMatchObject({ displayNameKind: 'generated' })
  })

  it('validates additive navigation intent', () => {
    expect(WorktreeActivate.parse({ worktree: 'id:wt-1', navigation: 'clients' }).navigation).toBe(
      'clients'
    )
    expect(
      WorktreeActivate.safeParse({ worktree: 'id:wt-1', navigation: 'everyone' }).success
    ).toBe(false)
  })

  it('rejects invalid startup agent values', () => {
    const parsed = WorktreeCreate.safeParse({
      repo: 'repo-1',
      name: 'agent-startup',
      startupAgent: 'wat',
      startupPrompt: 'hi'
    })

    expect(parsed.success).toBe(false)
  })

  it('rejects startup prompts without startup agents', () => {
    const parsed = WorktreeCreate.safeParse({
      repo: 'repo-1',
      name: 'agent-startup',
      startupPrompt: 'hi'
    })

    expect(parsed.success).toBe(false)
  })

  it.each([
    [
      'github',
      'https://github.example.test/acme/app/issues/42',
      { provider: 'github', host: 'github.example.test', owner: 'acme', repo: 'app' }
    ],
    [
      'gitlab',
      'https://gitlab.example.test/acme/app/-/issues/42',
      {
        provider: 'gitlab',
        webUrl: 'https://gitlab.example.test/acme/app',
        namespace: 'acme',
        project: 'app'
      }
    ]
  ] as const)(
    'normalizes durable %s metadata and rejects provider mismatches',
    (provider, url, providerIdentity) => {
      const linkedWorkItem = {
        provider,
        type: 'issue',
        number: 42,
        title: ' Issue 42 ',
        url: ` ${url} `
      }
      const linkedTaskSourceContext = {
        kind: 'task-source',
        provider,
        projectId: ' project-1 ',
        hostId: 'runtime:env-1',
        providerIdentity
      }
      const parsed = WorktreeCreate.parse({
        repo: 'repo-1',
        name: 'source-link',
        linkedWorkItem,
        linkedTaskSourceContext
      })

      expect(parsed.linkedWorkItem).toMatchObject({ provider, title: 'Issue 42', url })
      expect(parsed.linkedTaskSourceContext).toMatchObject({
        provider,
        projectId: 'project-1',
        hostId: 'runtime:env-1',
        providerIdentity
      })
      expect(
        WorktreeCreate.safeParse({
          repo: 'repo-1',
          name: 'mismatch',
          linkedWorkItem,
          linkedTaskSourceContext: {
            ...linkedTaskSourceContext,
            provider: provider === 'github' ? 'gitlab' : 'github',
            providerIdentity: null
          }
        }).success
      ).toBe(false)
      const malformed = {
        repo: 'repo-1',
        name: 'malformed',
        linkedWorkItem,
        linkedTaskSourceContext: { ...linkedTaskSourceContext, accountLabel: 44 }
      }
      expect(() => WorktreeCreate.safeParse(malformed)).not.toThrow()
      expect(WorktreeCreate.safeParse(malformed).success).toBe(false)
    }
  )

  it.each(['jira', 'linear'])('rejects retired %s linked-item metadata', (provider) => {
    expect(
      WorktreeCreate.safeParse({
        repo: 'repo-1',
        name: 'retired-source',
        linkedWorkItem: {
          provider,
          type: 'issue',
          number: 42,
          title: 'Issue 42',
          url: 'https://example.test/issues/42'
        }
      }).success
    ).toBe(false)
  })

  it('keeps a blanked display name on remote hosts instead of dropping the clear', () => {
    // Blanking sends displayName:'' meaning "fall back to the branch/folder name".
    // Coercing it to undefined made updateManagedWorktreeMeta's omitUndefinedProperties
    // drop the key, so an SSH/paired-web rename-to-blank silently kept the old name.
    const parsed = WorktreeSet.parse({ worktree: 'id:r1::/repos/wt', displayName: '' })

    expect(parsed.displayName).toBe('')
    expect(Object.hasOwn(parsed, 'displayName')).toBe(true)
  })

  it('still omits a display name that was never sent', () => {
    const parsed = WorktreeSet.parse({ worktree: 'id:r1::/repos/wt', comment: 'note' })

    expect(parsed.displayName).toBeUndefined()
    expect(Object.hasOwn(parsed, 'displayName')).toBe(false)
  })

  it('ignores a non-string display name rather than persisting it', () => {
    const parsed = WorktreeSet.parse({ worktree: 'id:r1::/repos/wt', displayName: 42 })

    expect(parsed.displayName).toBeUndefined()
  })

  it('parses optional GitHub PR suppression writes and clears', () => {
    expect(
      WorktreeSet.parse({ worktree: 'id:r1::/repos/wt', suppressedGitHubPR: 42 }).suppressedGitHubPR
    ).toBe(42)
    expect(
      WorktreeSet.parse({ worktree: 'id:r1::/repos/wt', suppressedGitHubPR: null })
        .suppressedGitHubPR
    ).toBeNull()
    expect(
      WorktreeSet.safeParse({ worktree: 'id:r1::/repos/wt', suppressedGitHubPR: 0 }).success
    ).toBe(false)
  })
})
