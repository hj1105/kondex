import path from 'node:path'

// Run the production MCP bundle, but never discover real CLIs or inherit credentials.
const retained = new Set([
  'HOME',
  'USERPROFILE',
  'SystemRoot',
  'SYSTEMROOT',
  'TMPDIR',
  'TEMP',
  'TMP',
  'KONTEXT_PLUGIN_DATA',
  'KONTEXT_HOST_MANAGEMENT_TOKEN',
  'ELECTRON_RUN_AS_NODE'
])
for (const key of Object.keys(process.env)) {
  if (!retained.has(key)) {
    Reflect.deleteProperty(process.env, key)
  }
}
const home = process.env.HOME
const data = process.env.KONTEXT_PLUGIN_DATA
if (
  !home ||
  !data ||
  !/^orca-e2e-(?:userdata|restart)-/.test(path.basename(path.dirname(home))) ||
  path.dirname(home) !== path.dirname(data)
) {
  throw new Error('Source E2E requires an isolated test profile')
}
process.env.PATH = ''
process.env.CODEX_HOME = path.join(home, '.codex')
process.env.CLAUDE_CONFIG_DIR = path.join(home, '.claude')
process.env.XDG_CONFIG_HOME = path.join(home, '.config')
process.env.ORCA_BACKGROUND_LAUNCH = '1'
await import('../../../resources/kontext/server.mjs')
