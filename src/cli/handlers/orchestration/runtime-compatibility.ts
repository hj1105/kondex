import { RuntimeClientError } from '../../runtime-client'

export type CompatibilityCliCommand = 'kondex' | 'kondex-dev' | 'orca' | 'orca-ide' | 'orca-dev'

export function resolveCompatibilityCliCommand(): CompatibilityCliCommand {
  const configured = process.env.KONDEX_CLI_COMMAND ?? process.env.ORCA_CLI_COMMAND
  if (
    configured === 'kondex' ||
    configured === 'kondex-dev' ||
    configured === 'orca' ||
    configured === 'orca-ide' ||
    configured === 'orca-dev'
  ) {
    return configured
  }
  return 'kondex'
}

export function resolvePackagedWindowsCompatibilityCommand():
  | 'kondex'
  | 'orca'
  | 'orca-ide'
  | undefined {
  if (process.env.ORCA_WINDOWS_PACKAGED_CLI_LAUNCHER !== '1') {
    return undefined
  }
  const command = process.env.KONDEX_CLI_COMMAND ?? process.env.ORCA_CLI_COMMAND
  if (command === 'kondex' || command === 'orca' || command === 'orca-ide') {
    return command
  }
  throw new RuntimeClientError(
    'invalid_argument',
    'The packaged Kondex launcher did not provide a valid resume command. No question was created.'
  )
}

export async function flushOrchestrationStdout(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    process.stdout.write('', (error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}

export function isDevCliInvocation(): boolean {
  return (
    process.env.ORCA_DEV_CLI_INVOCATION === '1' ||
    (process.env.ORCA_USER_DATA_PATH?.includes('kondex-dev') ?? false) ||
    (process.env.ORCA_USER_DATA_PATH?.includes('orca-dev') ?? false)
  )
}
