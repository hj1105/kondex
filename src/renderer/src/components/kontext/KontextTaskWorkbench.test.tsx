// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n/i18n'
import { readKontextRequests } from './kontext-request-journal'
import { taskInventoryFixture } from '../../../../shared/__fixtures__/kontext-task-inventory'

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  environmentId: null as string | null,
  revision: 1 as number | undefined
}))
vi.mock('@/runtime/runtime-rpc-client', () => ({ callRuntimeRpc: mocks.rpc }))
vi.mock('@/runtime/runtime-environment-revision', () => ({
  getRuntimeEnvironmentRevision: () => mocks.revision
}))
vi.mock('@/store', () => ({
  useAppStore: (selector: (state: unknown) => unknown) =>
    selector({ settings: { activeRuntimeEnvironmentId: mocks.environmentId } })
}))
import { KontextTaskWorkbench } from './KontextTaskWorkbench'

const task = {
  taskId: 'task:test',
  status: 'current',
  codeRevision: 'revision:one',
  contextDigest: 'context:one',
  contract: {
    taskId: 'task:test',
    intent: 'Implement the registered handler',
    risk: 'low',
    targets: ['symbol:one'],
    nonGoals: [],
    acceptance: [
      {
        criterionId: 'criterion:one',
        statement: 'The handler passes its test',
        verifier: { kind: 'test', ref: 'workspace:test' }
      }
    ]
  },
  requiredEvidenceIds: ['evidence:one'],
  normativeRevisionCount: 1,
  conflictCount: 0,
  logic: [
    {
      workItemId: 'logic:one',
      plannedSymbolIds: ['symbol:one'],
      allowedPaths: ['src/handler.ts'],
      dependsOn: []
    }
  ]
}
const job = {
  jobId: 'job:one',
  taskId: task.taskId,
  repositoryPath: '/fixture/repo',
  codeRevision: task.codeRevision,
  contextDigest: task.contextDigest,
  status: 'queued',
  requestedAt: '2026-09-06T00:00:00.000Z',
  resumeCount: 0
}

beforeEach(async () => {
  window.localStorage.clear()
  mocks.environmentId = null
  mocks.revision = 1
  mocks.rpc.mockReset()
  mocks.rpc.mockImplementation(
    async (_owner: unknown, method: string, params: Record<string, unknown>) => {
      if (method === 'kontext.inspectTask') {
        return task
      }
      if (method === 'kontext.enqueueSchedule') {
        return { ...job, requestId: params.requestId }
      }
      throw new Error(`Unexpected fixture method ${method}`)
    }
  )
  await i18n.changeLanguage('en')
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  window.localStorage.clear()
})

async function loadPreparedTask() {
  fireEvent.change(screen.getByLabelText('Task ID'), { target: { value: task.taskId } })
  fireEvent.click(screen.getByRole('button', { name: 'Load task' }))
  await screen.findByText(task.contract.intent)
  fireEvent.change(screen.getByLabelText('Worktree path or selector'), {
    target: { value: '/fixture/repo' }
  })
}
function consent() {
  fireEvent.click(screen.getByRole('checkbox', { name: /Allow subscription CLI execution/ }))
}

describe('Kontext task workbench', () => {
  it('opens a listed Task without carrying another Task execution or consent into it', async () => {
    render(<KontextTaskWorkbench />)
    await loadPreparedTask()
    consent()
    fireEvent.click(screen.getByRole('button', { name: 'Start schedule' }))
    await screen.findByText('Queued')
    const other = {
      ...task,
      taskId: 'task:other',
      contract: { ...task.contract, taskId: 'task:other', intent: 'Inspect another task' }
    }
    const row = {
      ...taskInventoryFixture.tasks[0]!,
      taskId: other.taskId,
      intent: other.contract.intent,
      latestSchedule: null,
      scheduleCount: 0
    }
    mocks.rpc.mockImplementation(async (_owner, method) => {
      if (method === 'kontext.listTasks') {
        return { ...taskInventoryFixture, tasks: [row] }
      }
      if (method === 'kontext.inspectTask') {
        return other
      }
      throw new Error('Unexpected fixture method')
    })
    fireEvent.click(screen.getByRole('button', { name: 'Load task list' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Open task: Inspect another task' }))
    await waitFor(() =>
      expect(screen.getByLabelText('Worktree path or selector')).toHaveProperty(
        'value',
        row.workspacePath
      )
    )
    await waitFor(() => expect(screen.queryByText('Queued')).toBeNull())
    expect(screen.getByRole('button', { name: 'Start schedule' }).hasAttribute('disabled')).toBe(
      true
    )
    expect(readKontextRequests(window.localStorage, { kind: 'local' })).toHaveLength(1)
  })
  it('loads actual sidecar planning and saves the exact request before enqueueing once', async () => {
    render(<KontextTaskWorkbench />)
    expect(mocks.rpc).not.toHaveBeenCalled()
    await loadPreparedTask()
    const button = screen.getByRole('button', { name: 'Start schedule' })
    expect(button.hasAttribute('disabled')).toBe(true)
    consent()
    mocks.rpc.mockImplementation(
      async (_owner: unknown, method: string, params: Record<string, unknown>) => {
        expect(method).toBe('kontext.enqueueSchedule')
        const persisted = readKontextRequests(window.localStorage, { kind: 'local' })
        expect(persisted).toHaveLength(1)
        expect(persisted[0]?.request).toEqual(params)
        expect(persisted[0]?.phase).toBe('pending')
        return { ...job, requestId: params.requestId }
      }
    )
    fireEvent.click(button)
    fireEvent.click(button)
    await screen.findByText('Queued')
    expect(
      mocks.rpc.mock.calls.filter((call) => call[1] === 'kontext.enqueueSchedule')
    ).toHaveLength(1)
    expect(screen.getByText(/Runner completion is not verified Task completion/)).toBeTruthy()
  })

  it('recovers an ambiguous response with the same ID instead of creating another request', async () => {
    render(<KontextTaskWorkbench />)
    await loadPreparedTask()
    consent()
    mocks.rpc.mockRejectedValueOnce(new Error('Transport response lost'))
    fireEvent.click(screen.getByRole('button', { name: 'Start schedule' }))
    await screen.findByText('Outcome unknown')
    const first = readKontextRequests(window.localStorage, { kind: 'local' })[0]
    fireEvent.click(screen.getByRole('button', { name: 'Start schedule' }))
    await screen.findByText(/existing request for this task needs recovery/)
    expect(
      mocks.rpc.mock.calls.filter((call) => call[1] === 'kontext.enqueueSchedule')
    ).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Recover original request' }))
    await screen.findByText('Queued')
    expect(mocks.rpc.mock.calls.at(-1)?.[2]).toEqual(first?.request)
    expect(readKontextRequests(window.localStorage, { kind: 'local' })).toHaveLength(1)
  })

  it('restores saved state without automatically querying or resuming on remount', async () => {
    const view = render(<KontextTaskWorkbench />)
    await loadPreparedTask()
    consent()
    fireEvent.click(screen.getByRole('button', { name: 'Start schedule' }))
    await screen.findByText('Queued')
    view.unmount()
    mocks.rpc.mockClear()
    render(<KontextTaskWorkbench />)
    expect(screen.getByText('Queued')).toBeTruthy()
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: 'Refresh / revalidate' }).hasAttribute('disabled')
    ).toBe(true)
  })

  it('does not enqueue if local recovery information cannot be saved', async () => {
    render(<KontextTaskWorkbench />)
    await loadPreparedTask()
    consent()
    const storage = window.localStorage
    vi.spyOn(window, 'localStorage', 'get').mockReturnValue({
      get length() {
        return storage.length
      },
      key: storage.key.bind(storage),
      getItem: storage.getItem.bind(storage),
      removeItem: storage.removeItem.bind(storage),
      clear: storage.clear.bind(storage),
      setItem: () => {
        throw new Error('Storage quota exceeded')
      }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Start schedule' }))
    await screen.findByText('Storage quota exceeded')
    expect(mocks.rpc.mock.calls.map((call) => call[1])).toEqual(['kontext.inspectTask'])
  })

  it('refuses execution after re-pairing the same runtime ID', async () => {
    mocks.environmentId = 'remote:one'
    render(<KontextTaskWorkbench />)
    await loadPreparedTask()
    consent()
    mocks.revision = 2
    fireEvent.click(screen.getByRole('button', { name: 'Start schedule' }))
    await screen.findByText(/selected runtime pairing changed/)
    expect(mocks.rpc.mock.calls.map((call) => call[1])).toEqual(['kontext.inspectTask'])
  })

  it('keeps a mismatched job response unknown and preserves the original request', async () => {
    render(<KontextTaskWorkbench />)
    await loadPreparedTask()
    consent()
    mocks.rpc.mockResolvedValueOnce({
      ...job,
      requestId: crypto.randomUUID(),
      taskId: 'task:other'
    })
    fireEvent.click(screen.getByRole('button', { name: 'Start schedule' }))
    await screen.findByText('Outcome unknown')
    const saved = readKontextRequests(window.localStorage, { kind: 'local' })[0]
    expect(saved?.request.taskId).toBe(task.taskId)
    expect(saved?.job).toBeUndefined()
    expect(screen.queryByText('Queued')).toBeNull()
  })

  it('preserves corrupt recovery records and disables new execution', async () => {
    const key = 'kondex.kontext.enqueue.v1.corrupt'
    window.localStorage.setItem(key, '{invalid')
    render(<KontextTaskWorkbench />)
    await loadPreparedTask()
    consent()
    expect(screen.getByRole('button', { name: 'Start schedule' }).hasAttribute('disabled')).toBe(
      true
    )
    expect(window.localStorage.getItem(key)).toBe('{invalid')
    expect(mocks.rpc.mock.calls.map((call) => call[1])).toEqual(['kontext.inspectTask'])
  })

  it('retains cancellation pending instead of claiming workers stopped', async () => {
    render(<KontextTaskWorkbench />)
    await loadPreparedTask()
    consent()
    fireEvent.click(screen.getByRole('button', { name: 'Start schedule' }))
    await screen.findByText('Queued')
    const saved = readKontextRequests(window.localStorage, { kind: 'local' })[0]
    mocks.rpc.mockResolvedValue({
      ...job,
      requestId: saved?.request.requestId,
      status: 'cancelling'
    })
    fireEvent.click(screen.getByRole('button', { name: 'Request cancellation' }))
    await screen.findByText('Cancellation pending')
    expect(screen.queryByText('Cancellation confirmed')).toBeNull()
    expect(mocks.rpc.mock.calls.at(-1)?.[1]).toBe('kontext.cancelSchedule')
  })

  it('changes utility labels to Korean without changing the host task content', async () => {
    render(<KontextTaskWorkbench />)
    await loadPreparedTask()
    await act(async () => {
      await i18n.changeLanguage('ko')
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '작업 실행' })).toBeTruthy()
    })
    expect(screen.getByText(task.contract.intent)).toBeTruthy()
    expect(screen.getByText('필수 근거 ID')).toBeTruthy()
  })
})
