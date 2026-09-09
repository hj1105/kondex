// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n/i18n'
import { KontextOntologyAddSource } from './KontextOntologyAddSource'

beforeEach(async () => {
  await i18n.changeLanguage('en')
})
afterEach(cleanup)

function open(onAdd = vi.fn().mockResolvedValue(true)) {
  render(<KontextOntologyAddSource disabled={false} onAdd={onAdd} />)
  fireEvent.click(screen.getByRole('button', { name: 'Add a source' }))
  return onAdd
}

const valueOf = (label: string): string =>
  (screen.getByLabelText(label) as HTMLInputElement | HTMLSelectElement).value
const addButton = (): HTMLButtonElement =>
  screen.getByRole('button', { name: 'Add' }) as HTMLButtonElement

describe('Kontext ontology add-source dialog', () => {
  it('turns a pasted repository URL into a git source with no server or token', async () => {
    const onAdd = open()
    fireEvent.click(screen.getByRole('button', { name: 'GitHub repository' }))
    expect(valueOf('Transport')).toBe('git')
    fireEvent.change(screen.getByLabelText('Repository URL'), {
      target: { value: ' https://github.com/org/handbook.git ' }
    })
    fireEvent.change(screen.getByLabelText('Branch or tag (optional)'), {
      target: { value: 'release' }
    })
    fireEvent.click(addButton())
    await vi.waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1))
    expect(onAdd).toHaveBeenCalledWith({
      name: 'github_repo',
      transport: 'git',
      url: 'https://github.com/org/handbook.git',
      ref: 'release'
    })
    // Why: the dialog closes only after the add succeeded, so a failure keeps the input.
    await vi.waitFor(() => expect(screen.queryByLabelText('Repository URL')).toBeNull())
  })

  it('gives a stdio server its environment, keeping "=" inside a value intact', async () => {
    const onAdd = open()
    fireEvent.click(screen.getByRole('button', { name: 'GitHub MCP server' }))
    expect(valueOf('Transport')).toBe('stdio')
    expect(valueOf('Layer')).toBe('github_pr')
    fireEvent.change(screen.getByLabelText('Command that starts the server'), {
      target: { value: 'npx' }
    })
    fireEvent.change(screen.getByLabelText('Arguments, one per line'), {
      target: { value: '-y\n@modelcontextprotocol/server-github\n' }
    })
    fireEvent.change(screen.getByLabelText('Environment for the server, KEY=VALUE per line'), {
      target: {
        value: 'GITHUB_PERSONAL_ACCESS_TOKEN=ghp_x\n\nGITHUB_API_URL=https://ghe.invalid/api?v=3'
      }
    })
    fireEvent.click(addButton())
    await vi.waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1))
    expect(onAdd).toHaveBeenCalledWith({
      name: 'github_pr',
      transport: 'stdio',
      type: 'github_pr',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env: {
        GITHUB_PERSONAL_ACCESS_TOKEN: 'ghp_x',
        GITHUB_API_URL: 'https://ghe.invalid/api?v=3'
      }
    })
  })

  it('does not send a git ref or a stdio environment on a transport that has none', async () => {
    const onAdd = open()
    fireEvent.click(screen.getByRole('button', { name: 'Markdown' }))
    expect(screen.queryByLabelText('Branch or tag (optional)')).toBeNull()
    expect(screen.queryByLabelText('Environment for the server, KEY=VALUE per line')).toBeNull()
    fireEvent.change(screen.getByLabelText('Directory to read'), { target: { value: '/docs' } })
    fireEvent.click(addButton())
    await vi.waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1))
    expect(onAdd).toHaveBeenCalledWith({ name: 'local', transport: 'local', path: '/docs' })
  })

  it('keeps Add disabled until both a name and an address exist', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: 'GitHub repository' }))
    expect(addButton().disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Repository URL'), {
      target: { value: 'https://github.com/org/handbook.git' }
    })
    expect(addButton().disabled).toBe(false)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  ' } })
    expect(addButton().disabled).toBe(true)
  })
})
