import { resolve } from 'node:path'
import { LOCAL_EXECUTION_HOST_ID } from '../../shared/execution-host'
import type { RuntimeGitTarget } from '../runtime/runtime-git-command-target'

export function kontextScheduleRepositoryPath(target: RuntimeGitTarget): string {
  if (target.executionHostId !== LOCAL_EXECUTION_HOST_ID || target.localGitOptions?.wslDistro) {
    throw new Error(
      'Kontext scheduling requires a sidecar on the execution host; local fallback is not allowed.'
    )
  }
  return resolve(target.worktree.git.path)
}
