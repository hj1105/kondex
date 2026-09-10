// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { KontextOntologyServerMappingPanel, toMapping } from './KontextOntologyServerMappingPanel'

const servers = [
  { name: 'docs', transport: 'local' as const, type: null, target: '/docs' },
  { name: 'issues', transport: 'http' as const, type: null, target: 'https://mcp.example.com' }
]

describe('toMapping', () => {
  it('drops empty optional paths and refuses invalid fixed arguments', () => {
    const draft = {
      listTool: 'list_issues',
      listArguments: '{"state":"open"}',
      items: 'items',
      id: 'number',
      title: '',
      readTool: 'get_issue',
      idArgument: 'number',
      content: ''
    }
    expect(toMapping(draft)).toEqual({
      list: { tool: 'list_issues', arguments: { state: 'open' }, items: 'items', id: 'number' },
      read: { tool: 'get_issue', idArgument: 'number' }
    })
    expect(toMapping({ ...draft, listArguments: 'not json' })).toBeNull()
    expect(toMapping({ ...draft, readTool: '' })).toBeNull()
  })
})

describe('KontextOntologyServerMappingPanel', () => {
  afterEach(cleanup)

  it('renders nothing when no source is an MCP server', () => {
    const { container } = render(
      <KontextOntologyServerMappingPanel
        sources={[servers[0]!]}
        inspection={null}
        disabled={false}
        busy={null}
        onInspect={vi.fn()}
        onMap={vi.fn()}
      />
    )
    expect(container.childElementCount).toBe(0)
  })

  it('inspects the chosen server, lists its tools, and saves a mapping through the callback', async () => {
    const onInspect = vi.fn()
    const onMap = vi.fn().mockResolvedValue(true)
    render(
      <KontextOntologyServerMappingPanel
        sources={servers}
        inspection={{
          command: 'inspect',
          ok: true,
          name: 'issues',
          transport: 'http',
          resourceCount: 0,
          tools: [
            { name: 'list_issues', description: 'List issues' },
            { name: 'get_issue', description: 'Read one issue' }
          ]
        }}
        disabled={false}
        busy={null}
        onInspect={onInspect}
        onMap={onMap}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Look at the server' }))
    expect(onInspect).toHaveBeenCalledWith('issues')
    expect(screen.getByRole('status').textContent).toBe('0 resources, 2 tools')
    expect(screen.getByText('list_issues')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Map documents…' }))
    fireEvent.change(screen.getByLabelText('Tool that lists documents'), {
      target: { value: 'list_issues' }
    })
    fireEvent.change(
      screen.getByLabelText('Path to the array of items (empty if the result is the array)'),
      {
        target: { value: 'items' }
      }
    )
    fireEvent.change(screen.getByLabelText('Path to the id inside an item'), {
      target: { value: 'number' }
    })
    fireEvent.change(screen.getByLabelText('Tool that reads one document'), {
      target: { value: 'get_issue' }
    })
    fireEvent.change(screen.getByLabelText('Argument that receives the id'), {
      target: { value: 'number' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save mapping' }))
    expect(onMap).toHaveBeenCalledWith('issues', {
      list: { tool: 'list_issues', items: 'items', id: 'number' },
      read: { tool: 'get_issue', idArgument: 'number' }
    })
  })
})
