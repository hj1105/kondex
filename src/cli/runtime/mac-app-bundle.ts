import { dirname } from 'node:path'

/** Returns the containing .app bundle when the executable is a macOS bundle binary. */
export function getMacAppBundlePath(executable: string): string | null {
  if (process.platform !== 'darwin') {
    return null
  }
  const macOsDir = dirname(executable)
  const contentsDir = dirname(macOsDir)
  const appBundlePath = dirname(contentsDir)
  return appBundlePath.endsWith('.app') ? appBundlePath : null
}
