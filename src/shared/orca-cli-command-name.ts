export function getOrcaCliCommandNameForPlatform(platform: NodeJS.Platform): string {
  if (platform === 'win32') {
    return 'kondex.cmd'
  }
  return 'kondex'
}
