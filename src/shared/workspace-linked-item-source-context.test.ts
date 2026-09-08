import { describe, expect, it } from 'vitest'
import { isWorkspaceLinkedItemSourceContextMatch } from './workspace-linked-item-source-context'

describe('workspace linked-item source context', () => {
  it('matches explicitly identified GitLab items', () => {
    expect(
      isWorkspaceLinkedItemSourceContextMatch(
        {
          provider: 'gitlab',
          type: 'issue',
          number: 0,
          title: 'GitLab item',
          url: 'https://gitlab.com/acme/repo/-/issues/1'
        },
        {
          kind: 'task-source',
          provider: 'gitlab',
          projectId: 'project-1',
          hostId: 'local'
        }
      )
    ).toBe(true)
  })

  it('infers GitHub/GitLab provider when seeds omit provider', () => {
    expect(
      isWorkspaceLinkedItemSourceContextMatch(
        {
          type: 'issue',
          number: 42,
          title: 'GitHub issue',
          url: 'https://github.com/acme/repo/issues/42'
        },
        {
          kind: 'task-source',
          provider: 'github',
          projectId: 'project-1',
          hostId: 'local'
        }
      )
    ).toBe(true)
    expect(
      isWorkspaceLinkedItemSourceContextMatch(
        {
          type: 'mr',
          number: 7,
          title: 'GitLab MR',
          url: 'https://gitlab.com/acme/repo/-/merge_requests/7'
        },
        {
          kind: 'task-source',
          provider: 'gitlab',
          projectId: 'project-1',
          hostId: 'local'
        }
      )
    ).toBe(true)
  })
})
