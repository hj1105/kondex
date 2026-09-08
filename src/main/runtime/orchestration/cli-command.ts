import type { ProjectExecutionRuntimeResolution } from '../../../shared/project-execution-runtime'

export type OrchestrationCliCommand = 'kondex' | 'orca'

export function resolveTerminalOrchestrationCliCommand(args: {
  connectionId: string | null
  isWsl: boolean | null | undefined
  worktreeId: string
  projectRuntime?: ProjectExecutionRuntimeResolution
}): OrchestrationCliCommand {
  if (args.connectionId) {
    // Direct-SSH hosts may still expose the upstream compatibility shim.
    return 'orca'
  }
  return 'kondex'
}
