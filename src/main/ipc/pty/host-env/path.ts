import { resolvePathEnvKey } from '../../../pty/windows-environment-path'

export function readInheritedPath(baseEnv: Record<string, string>): string {
  const pathKey = resolvePathEnvKey(baseEnv, process.platform)
  return baseEnv[pathKey] ?? process.env[pathKey] ?? ''
}

export function deleteRequestedEnvKeys(
  env: Record<string, string> | undefined,
  keys: string[] | undefined
): void {
  if (!env || !keys) {
    return
  }
  for (const key of keys) {
    delete env[key]
  }
}
