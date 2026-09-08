export function shouldReadRemoteCliStdin(argv: string[]): boolean {
  if (argv.includes('--help') || argv.includes('-h')) {
    return false
  }
  // Why: computer-use style flags (`--text-stdin`, ...) declare a stdin
  // payload directly in the flag name; the full-CLI bridge (#7716) must
  // forward stdin for them the same way local shells provide it.
  if (argv.some((part) => /^--[a-z0-9][a-z0-9-]*-stdin(?:=|$)/.test(part))) {
    return true
  }
  return false
}
