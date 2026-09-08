import { describe, expect, it } from 'vitest'
import { isWorkItemLookupText } from './work-item-lookup-text'

describe('isWorkItemLookupText Jira URLs', () => {
  it('does not replace deliberate names containing retired Jira references', () => {
    expect(isWorkItemLookupText('https://company.atlassian.net/browse/ORCA-123')).toBe(false)
    expect(isWorkItemLookupText('http://jira.example.com:8080/jira/browse/TEAM_CORE-42')).toBe(
      false
    )
  })

  it.each(['https://github.com/team/repo/issues/123', 'https://gitlab.com/team/repo/-/issues/42'])(
    'retains supported source-control lookup %s',
    (reference) => expect(isWorkItemLookupText(reference)).toBe(true)
  )

  it('does not claim bare Jira-shaped keys or malformed browse URLs', () => {
    expect(isWorkItemLookupText('ORCA-123')).toBe(false)
    expect(isWorkItemLookupText('https://jira.example.com/browse/ORCA-123/extra')).toBe(false)
  })
})
