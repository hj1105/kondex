import { isAbsolute } from 'node:path'
import { LOCAL_EXECUTION_HOST_ID } from '../../shared/execution-host'
import { isWslUncPath } from '../../shared/wsl-paths'
import type { ResolvedRuntimeFileTarget } from '../runtime/runtime-file-command-target'

export function kontextSourceWorkspacePath(target: ResolvedRuntimeFileTarget): string {
  if (target.executionHostId !== LOCAL_EXECUTION_HOST_ID || isWslUncPath(target.worktree.path)) {
    throw new Error(
      'Kontext source registration requires a sidecar on the file host; local fallback is not allowed.'
    )
  }
  if (!isAbsolute(target.worktree.path)) {
    throw new Error('Kontext source workspace must have an absolute host path.')
  }
  return target.worktree.path
}
