import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { runProcess } from '../../../src/shared/child-process/run-process'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})
async function invoke(provider: string, args: string[], requests: unknown[]) {
  const root = await mkdtemp(path.join(tmpdir(), 'orca-e2e-restart-protocol-'))
  roots.push(root)
  const bin = path.join(root, 'bin')
  await mkdir(bin)
  const binary = path.join(bin, provider)
  await writeFile(
    binary,
    await readFile(path.resolve('tests/e2e/fixtures/kontext-source-protocol-agent.mjs'))
  )
  const result = await runProcess({
    program: process.execPath,
    args: [binary, ...args],
    input: `${requests.map((request) => JSON.stringify(request)).join('\n')}\n`,
    timeoutMs: 5000,
    env: { PATH: '', HOME: root, USERPROFILE: root }
  })
  const trace = (await readFile(path.join(root, 'provider-protocol.jsonl'), 'utf8'))
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line))
  return { result, trace }
}
it('permits only the offline startup hook inventory protocol', async () => {
  const { result, trace } = await invoke(
    'codex',
    ['app-server'],
    [
      { id: 1, method: 'initialize', params: { clientInfo: { name: 'fixture' } } },
      { method: 'initialized' },
      { id: 2, method: 'hooks/list' }
    ]
  )
  expect(result.code).toBe(0)
  expect(trace.some((entry) => entry.kind === 'forbidden')).toBe(false)
  expect(result.stdout).toContain('"data":[]')
})
it.each(['thread/start', 'thread/resume', 'turn/start', 'config/batchWrite'])(
  'rejects and records %s',
  async (method) => {
    const { result, trace } = await invoke('codex', ['app-server'], [{ id: 1, method }])
    expect(result.code).toBe(97)
    expect(trace).toContainEqual({
      kind: 'forbidden',
      reason: 'Unexpected protocol request',
      method
    })
  }
)
it.each([
  ['codex', ['exec', 'fixture']],
  ['claude', ['-p', 'fixture']]
] as const)('rejects %s model CLI entry points', async (provider, args) => {
  const { result, trace } = await invoke(provider, [...args], [])
  expect(result.code).toBe(97)
  expect(trace).toContainEqual({ kind: 'forbidden', reason: 'Unexpected provider launch' })
})
