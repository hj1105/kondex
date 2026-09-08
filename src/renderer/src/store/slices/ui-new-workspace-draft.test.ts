import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createUIStore } from './ui-slice-test-harness'

const mocks = vi.hoisted(() => ({
  sendNotesToActiveAgentSession: vi.fn(),
  toastMessage: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn()
}))

vi.mock('@/lib/active-agent-note-send', () => ({
  activeAgentNotesSendFailureMessage: (
    status: string,
    options: { explicitTarget?: boolean } = {}
  ) => (options.explicitTarget ? `selected:${status}` : status),
  sendNotesToActiveAgentSession: mocks.sendNotesToActiveAgentSession
}))

vi.mock('sonner', () => ({
  toast: {
    message: mocks.toastMessage,
    success: mocks.toastSuccess,
    error: mocks.toastError
  }
}))

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

beforeEach(() => {
  mocks.sendNotesToActiveAgentSession.mockReset()
  mocks.sendNotesToActiveAgentSession.mockResolvedValue({ status: 'sent' })
  mocks.toastMessage.mockReset()
  mocks.toastSuccess.mockReset()
  mocks.toastError.mockReset()
})

describe('createUISlice new workspace draft', () => {
  it('keeps older linked work item drafts without Linear context fields valid', () => {
    const store = createUIStore()

    store.getState().setNewWorkspaceDraft({
      repoId: 'repo-1',
      name: 'Legacy issue',
      prompt: '',
      note: '',
      attachments: [],
      linkedWorkItem: {
        type: 'issue',
        number: 42,
        title: 'Legacy issue',
        url: 'https://github.com/acme/repo/issues/42'
      },
      agent: 'claude',
      linkedIssue: '42',
      linkedPR: null,
      linkedGitLabIssue: null,
      linkedGitLabMR: null
    })

    expect(store.getState().newWorkspaceDraft?.linkedWorkItem).toEqual({
      type: 'issue',
      number: 42,
      title: 'Legacy issue',
      url: 'https://github.com/acme/repo/issues/42'
    })
  })
})
