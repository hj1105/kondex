import { describe, expect, it } from 'vitest'
import { getLinkedWorkItemProvider } from './new-workspace'

describe('getLinkedWorkItemProvider', () => {
  it.each([
    [
      'explicit GitLab metadata',
      {
        type: 'issue',
        provider: 'gitlab',
        number: 123,
        title: 'Fix it',
        url: 'https://git.example/acme/project/-/issues/123'
      },
      'gitlab'
    ],
    [
      'GitLab issue URL without provider metadata',
      {
        type: 'issue',
        number: 123,
        title: 'Fix it',
        url: 'https://gitlab.com/acme/project/-/issues/123'
      },
      'gitlab'
    ],
    [
      'GitLab merge request kind',
      {
        type: 'mr',
        number: 17,
        title: 'Fix it',
        url: 'https://git.example/acme/project/-/merge_requests/17'
      },
      'gitlab'
    ],
    [
      'GitHub fallback',
      {
        type: 'issue',
        number: 123,
        title: 'Fix it',
        url: 'https://github.com/acme/project/issues/123'
      },
      'github'
    ]
  ] as const)('detects %s', (_label, item, provider) => {
    expect(getLinkedWorkItemProvider(item)).toBe(provider)
  })
})
