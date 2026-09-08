import { mkdir, readFile, symlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

const home = process.env.HOME
const data = process.env.KONTEXT_PLUGIN_DATA
const node = process.env.KONDEX_PLAN_FIXTURE_NODE
if (
  process.platform === 'win32' ||
  !home ||
  !data ||
  !node ||
  !path.isAbsolute(node) ||
  !path.basename(path.dirname(home)).startsWith('orca-e2e-userdata-') ||
  path.dirname(home) !== path.dirname(data)
) {
  throw new Error('Planning E2E requires an isolated POSIX test profile and explicit Node path')
}
const retained = new Set([
  'HOME',
  'USERPROFILE',
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
const bin = path.join(data, 'planning-fixture-bin')
await mkdir(bin, { recursive: true, mode: 0o700 })
const fixture = await readFile(new URL('./kontext-planning-agent.mjs', import.meta.url), 'utf8')
for (const provider of ['codex', 'claude']) {
  await writeFile(path.join(bin, provider), `#!${node}\n${fixture}`, { mode: 0o700 })
}
try {
  await symlink('/usr/bin/git', path.join(bin, 'git'))
} catch (error) {
  if (error.code !== 'EEXIST') {
    throw error
  }
}
process.env.PATH = bin
process.env.CODEX_HOME = path.join(home, '.codex')
process.env.CLAUDE_CONFIG_DIR = path.join(home, '.claude')
process.env.XDG_CONFIG_HOME = path.join(home, '.config')
process.env.ORCA_BACKGROUND_LAUNCH = '1'
await import('../../../resources/kontext/server.mjs')
