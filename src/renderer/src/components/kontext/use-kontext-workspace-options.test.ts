import { describe, expect, it } from 'vitest'
import {
  kontextOwnerHostId,
  kontextWorkspaceSelector,
  listKontextWorkspaceOptions,
  type KontextWorkspaceOption
} from './use-kontext-workspace-options'

const worktree = (repoId: string, path: string, hostId?: string) => ({
  id: `${repoId}::${path}`,
  repoId,
  displayName: 'app',
  ...(hostId ? { hostId } : {})
})
const folder = (id: string, folderPath: string, extra: object = {}) => ({
  id,
  name: id,
  folderPath,
  projectGroupId: 'group',
  isArchived: false,
  ...extra
})
const list = (catalog: object, hostId: string) =>
  listKontextWorkspaceOptions(catalog as never, hostId as never)
const option = (
  id: string,
  directory: string,
  kind: KontextWorkspaceOption['kind'] = 'folder'
): KontextWorkspaceOption => ({ id, title: id, directory, kind })

describe('listKontextWorkspaceOptions', () => {
  const catalog = {
    repos: [
      { id: 'local-repo' },
      { id: 'remote-repo', executionHostId: 'runtime:R' },
      { id: 'ssh-repo', connectionId: 'box' }
    ],
    worktreesByRepo: {
      'remote-repo': [worktree('remote-repo', '/Users/me/app')],
      'local-repo': [worktree('local-repo', '/Users/me/app')],
      'ssh-repo': [worktree('ssh-repo', '/Users/me/app')]
    },
    folderWorkspaces: [
      folder('local-folder', '/Users/me/kondex'),
      folder('ssh-folder', '/Users/me/kondex', { connectionId: 'box' }),
      folder('runtime-folder', '/Users/me/kondex', { executionHostId: 'runtime:R' })
    ],
    projectGroups: []
  }

  it('lists only the local host for a local owner', () => {
    expect(list(catalog, kontextOwnerHostId({ kind: 'local' })).map((row) => row.id)).toEqual([
      'local-repo::/Users/me/app',
      'folder:local-folder'
    ])
  })

  it('lists only that runtime for an environment owner', () => {
    const hostId = kontextOwnerHostId({
      kind: 'environment',
      environmentId: 'R',
      pairingRevision: 1
    })
    expect(list(catalog, hostId).map((row) => row.id)).toEqual([
      'remote-repo::/Users/me/app',
      'folder:runtime-folder'
    ])
  })

  it('drops a legacy worktree whose repo id names two hosts', () => {
    const shared = {
      repos: [{ id: 'dup' }, { id: 'dup', connectionId: 'box' }],
      worktreesByRepo: { dup: [worktree('dup', '/a')] }
    }
    expect(list(shared, 'local')).toEqual([])
  })

  it('trusts the worktree host stamp over its repo', () => {
    const stamped = {
      repos: [{ id: 'r' }],
      worktreesByRepo: { r: [worktree('r', '/a', 'ssh:box')] }
    }
    expect(list(stamped, 'local')).toEqual([])
    expect(list(stamped, 'ssh:box')).toHaveLength(1)
  })
})

describe('kontextWorkspaceSelector', () => {
  const kondex = option('folder:k', '/Users/me/kondex')

  it('maps a path naming exactly one folder, with or without a trailing separator', () => {
    expect(kontextWorkspaceSelector('/Users/me/kondex', [kondex])).toBe('folder:k')
    expect(kontextWorkspaceSelector('  /Users/me/kondex//  ', [kondex])).toBe('folder:k')
  })

  it('leaves worktree paths for the host to resolve', () => {
    const tree = option('repo::/Users/me/app', '/Users/me/app', 'worktree')
    expect(kontextWorkspaceSelector('/Users/me/app', [tree])).toBe('/Users/me/app')
  })

  it('sends the input unchanged when two folders share the path', () => {
    const twin = option('folder:twin', '/Users/me/kondex/')
    expect(kontextWorkspaceSelector('/Users/me/kondex', [kondex, twin])).toBe('/Users/me/kondex')
  })

  it('keeps roots distinct from their children', () => {
    const root = option('folder:root', '/')
    expect(kontextWorkspaceSelector('/', [root, kondex])).toBe('folder:root')
    expect(kontextWorkspaceSelector('/Users', [root])).toBe('/Users')
  })

  it('compares Windows paths by drive, separator and case like the host', () => {
    const drive = option('folder:c', 'C:\\')
    const project = option('folder:p', 'C:\\Users\\Me\\Kondex')
    expect(kontextWorkspaceSelector('C:\\', [drive, project])).toBe('folder:c')
    expect(kontextWorkspaceSelector('c:/users/me/kondex/', [drive, project])).toBe('folder:p')
  })

  it('does not treat a POSIX backslash as a separator', () => {
    expect(kontextWorkspaceSelector('/Users/me\\kondex', [kondex])).toBe('/Users/me\\kondex')
  })

  it('passes selectors and blanks through', () => {
    expect(kontextWorkspaceSelector('folder:k', [kondex])).toBe('folder:k')
    expect(kontextWorkspaceSelector('   ', [kondex])).toBe('')
  })
})
