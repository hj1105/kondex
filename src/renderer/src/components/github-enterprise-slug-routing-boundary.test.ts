import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function componentSource(relativePath: string): string {
  return readFileSync(join(__dirname, relativePath), 'utf8')
}

function sourceBetween(source: string, startPattern: string, endPattern: string): string {
  const start = source.indexOf(startPattern)
  expect(start).toBeGreaterThanOrEqual(0)
  const end = source.indexOf(endPattern, start + startPattern.length)
  expect(end).toBeGreaterThan(start)
  return source.slice(start, end)
}

describe('GitHub Enterprise slug routing boundaries', () => {
  it('keeps PR base-repository hosts on checks-sidebar comment writes', () => {
    const source = componentSource(
      'right-sidebar/checks-panel/use-checks-panel-comment-mutations.tsx'
    )
    const conversationSection = sourceBetween(
      source,
      'const handleEditComment = useCallback',
      'const handleReplyToComment = useCallback'
    )

    expect(conversationSection).toContain('host: githubProjectHost(pr.prRepo.host)')
    expect(conversationSection).toContain('updateIssueCommentBySlug({')
    expect(conversationSection).toContain('deleteIssueCommentBySlug({')
  })
})
