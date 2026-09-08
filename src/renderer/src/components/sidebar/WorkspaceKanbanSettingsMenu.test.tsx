// @vitest-environment happy-dom
import { createRoot, type Root } from 'react-dom/client'
import { act, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WorkspaceStatusDefinition } from '../../../../shared/worktree/types'

const statuses: WorkspaceStatusDefinition[] = [{ id: 'todo', label: 'Todo' }]
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuLabel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>
}))

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>
}))

import WorkspaceKanbanSettingsMenu from './WorkspaceKanbanSettingsMenu'

let root: Root | null = null
let container: HTMLDivElement | null = null

function renderMenu({
  workspaceStatuses = statuses,
  onAddStatus = vi.fn<() => void>()
}: {
  workspaceStatuses?: WorkspaceStatusDefinition[]
  onAddStatus?: () => void
} = {}): void {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root?.render(
      <WorkspaceKanbanSettingsMenu
        workspaceStatuses={workspaceStatuses}
        onRenameStatus={vi.fn()}
        onChangeStatusColor={vi.fn()}
        onChangeStatusIcon={vi.fn()}
        onMoveStatus={vi.fn()}
        onRemoveStatus={vi.fn()}
        onAddStatus={onAddStatus}
      />
    )
  })
}

afterEach(() => {
  act(() => {
    root?.unmount()
  })
  root = null
  container?.remove()
  container = null
  document.body.innerHTML = ''
})

describe('WorkspaceKanbanSettingsMenu', () => {
  it('omits the removed external issue-status synchronization control', () => {
    renderMenu()
    expect(
      document.querySelector('button[role="switch"][aria-label="Sync board and issue status"]')
    ).toBeNull()
  })

  it('keeps adding available for workflows above the former board limit', () => {
    const onAddStatus = vi.fn()
    renderMenu({
      workspaceStatuses: Array.from({ length: 21 }, (_, index) => ({
        id: `state-${index + 1}`,
        label: `State ${index + 1}`
      })),
      onAddStatus
    })

    const addStatus = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Add status'
    )

    expect(addStatus?.disabled).toBe(false)
    addStatus?.click()
    expect(onAddStatus).toHaveBeenCalledOnce()
  })
})
