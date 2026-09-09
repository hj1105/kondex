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

  it('lists an organization, ticks working repositories by default, and adds each as a git source', async () => {
    const onAdd = vi.fn().mockResolvedValue(true)
    const repository = (name: string, extra: Record<string, unknown> = {}) => ({
      name,
      fullName: `modapl/${name}`,
      url: `https://github.com/modapl/${name}`,
      cloneUrl: `https://github.com/modapl/${name}.git`,
      defaultBranch: 'main',
      private: true,
      archived: false,
      fork: false,
      language: 'TypeScript',
      description: null,
      pushedAt: '2026-09-01T00:00:00Z',
      ...extra
    })
    const onListRepositories = vi.fn().mockResolvedValue({
      command: 'github-repos',
      ok: true,
      owner: 'modapl',
      kind: 'organization',
      repositories: [
        repository('sphere-admin'),
        repository('old-site', { archived: true }),
        repository('fleet-telemetry', { fork: true, language: null })
      ]
    })
    render(
      <KontextOntologyAddSource
        disabled={false}
        onAdd={onAdd}
        onListRepositories={onListRepositories}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Add a source' }))
    fireEvent.click(screen.getByRole('button', { name: 'GitHub organization' }))
    // Why: an organization has no single name or layer; those fields would only confuse.
    expect(screen.queryByLabelText('Name')).toBeNull()
    expect(screen.queryByLabelText('Layer')).toBeNull()
    fireEvent.change(screen.getByLabelText('Organization or user URL'), {
      target: { value: 'https://github.com/modapl' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Load repositories' }))
    await vi.waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain('3 repositories')
    )
    expect(onListRepositories).toHaveBeenCalledWith('https://github.com/modapl')
    // Archived and forked repositories stay hidden until asked for.
    expect(screen.queryByLabelText('modapl/old-site')).toBeNull()
    expect(screen.queryByLabelText('modapl/fleet-telemetry')).toBeNull()
    expect((screen.getByLabelText('modapl/sphere-admin') as HTMLInputElement).checked).toBe(true)
    fireEvent.click(screen.getByLabelText('Include forks'))
    const fork = screen.getByLabelText('modapl/fleet-telemetry') as HTMLInputElement
    expect(fork.checked).toBe(false)
    fireEvent.click(fork)
    fireEvent.click(screen.getByLabelText('Also read source code'))
    const add = screen.getByRole('button', { name: 'Add 2 selected' }) as HTMLButtonElement
    expect(add.disabled).toBe(false)
    fireEvent.click(add)
    await vi.waitFor(() => expect(onAdd).toHaveBeenCalledTimes(2))
    expect(onAdd).toHaveBeenNthCalledWith(1, {
      name: 'modapl-sphere-admin',
      transport: 'git',
      url: 'https://github.com/modapl/sphere-admin.git',
      code: true
    })
    expect(onAdd).toHaveBeenNthCalledWith(2, {
      name: 'modapl-fleet-telemetry',
      transport: 'git',
      url: 'https://github.com/modapl/fleet-telemetry.git',
      code: true
    })
    await vi.waitFor(() => expect(screen.queryByLabelText('Organization or user URL')).toBeNull())
  })

  it('keeps the dialog open and names the repositories that could not be added', async () => {
    const onAdd = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    const onListRepositories = vi.fn().mockResolvedValue({
      command: 'github-repos',
      ok: true,
      owner: 'modapl',
      kind: 'organization',
      repositories: ['a', 'b'].map((name) => ({
        name,
        fullName: `modapl/${name}`,
        url: `https://github.com/modapl/${name}`,
        cloneUrl: `https://github.com/modapl/${name}.git`,
        defaultBranch: 'main',
        private: false,
        archived: false,
        fork: false,
        language: null,
        description: null,
        pushedAt: null
      }))
    })
    render(
      <KontextOntologyAddSource
        disabled={false}
        onAdd={onAdd}
        onListRepositories={onListRepositories}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Add a source' }))
    fireEvent.click(screen.getByRole('button', { name: 'GitHub organization' }))
    fireEvent.change(screen.getByLabelText('Organization or user URL'), {
      target: { value: 'modapl' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Load repositories' }))
    await vi.waitFor(() => screen.getByRole('button', { name: 'Add 2 selected' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add 2 selected' }))
    await vi.waitFor(() => expect(onAdd).toHaveBeenCalledTimes(2))
    const statuses = screen.getAllByRole('status').map((node) => node.textContent ?? '')
    expect(statuses.join(' ')).toContain('Added 2 of 2.')
    expect(statuses.join(' ')).toContain('Could not add: modapl/a')
    // Why: the URL field stays so the user can retry without retyping.
    expect(screen.queryByLabelText('Organization or user URL')).not.toBeNull()
  })

  it('sends code: true for a single repository when asked to read source too', async () => {
    const onAdd = open()
    fireEvent.click(screen.getByRole('button', { name: 'GitHub repository' }))
    fireEvent.change(screen.getByLabelText('Repository URL'), {
      target: { value: 'https://github.com/org/handbook.git' }
    })
    fireEvent.click(screen.getByLabelText('Also read source code'))
    fireEvent.click(addButton())
    await vi.waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1))
    expect(onAdd).toHaveBeenCalledWith({
      name: 'github_repo',
      transport: 'git',
      url: 'https://github.com/org/handbook.git',
      code: true
    })
  })

  it('treats an owner URL pasted as a repository as the organization it names', () => {
    render(
      <KontextOntologyAddSource disabled={false} onAdd={vi.fn()} onListRepositories={vi.fn()} />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Add a source' }))
    fireEvent.click(screen.getByRole('button', { name: 'GitHub repository' }))
    fireEvent.change(screen.getByLabelText('Repository URL'), {
      target: { value: 'https://github.com/modapl' }
    })
    expect(valueOf('Organization or user URL')).toBe('https://github.com/modapl')
    expect(screen.getByRole('button', { name: 'Load repositories' })).toBeTruthy()
    expect(screen.queryByLabelText('Name')).toBeNull()
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
