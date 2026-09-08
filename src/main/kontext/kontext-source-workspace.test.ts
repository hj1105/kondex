import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { OrcaRuntimeWithPersistHeadlessTerminalTitle } from '../runtime/orca-runtime-persist-headless-terminal-title'
import type { ResolvedRuntimeFileTarget } from '../runtime/runtime-file-command-target'
import { kontextSourceWorkspacePath } from './kontext-source-workspace'

const folderPath = resolve('/host/Folder with spaces ')
function target(executionHostId: ResolvedRuntimeFileTarget['executionHostId'] = 'local') {
  return { executionHostId, worktree: { path: folderPath } } as ResolvedRuntimeFileTarget
}
describe('Kontext source workspace ownership', () => {
  it('uses the file workspace path without needing Git metadata', async () => {
    const resolveRuntimeFileTarget = vi.fn().mockResolvedValue(target())
    expect(
      await Reflect.apply(
        OrcaRuntimeWithPersistHeadlessTerminalTitle.prototype.resolveKontextSourceWorkspace,
        { resolveRuntimeFileTarget },
        ['folder-selector']
      )
    ).toBe(folderPath)
    expect(resolveRuntimeFileTarget).toHaveBeenCalledExactlyOnceWith('folder-selector')
  })
  it.each(['ssh:host', 'runtime:peer'] as const)(
    'rejects %s rather than reading locally',
    (host) => {
      expect(() => kontextSourceWorkspacePath(target(host))).toThrow(
        'local fallback is not allowed'
      )
    }
  )
  it.each(['\\\\wsl.localhost\\Ubuntu\\home\\user', '//wsl$/Ubuntu/home/user', 'relative/folder'])(
    'refuses a path not owned by the native sidecar: %s',
    (path) => {
      const selected = target()
      selected.worktree.path = path
      expect(() => kontextSourceWorkspacePath(selected)).toThrow()
    }
  )
  it('preserves ambiguous file-host resolution failure', async () => {
    const error = new Error('worktree_execution_host_unresolved')
    await expect(
      Reflect.apply(
        OrcaRuntimeWithPersistHeadlessTerminalTitle.prototype.resolveKontextSourceWorkspace,
        { resolveRuntimeFileTarget: vi.fn().mockRejectedValue(error) },
        ['ambiguous-folder']
      )
    ).rejects.toBe(error)
  })
})
