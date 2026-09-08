import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import type { ProcessTableRow } from '../../shared/process-table-snapshot'
import { resolveAgentForegroundProcessFromPs } from './agent-foreground-process'

type CapturedRun = {
  agent: string
  shellPid: number
  rows: ProcessTableRow[]
}

describe('real foreground process captures', () => {
  it('recognizes only retained providers in the historical six-provider captures', () => {
    const captured = JSON.parse(
      gunzipSync(readFileSync(join(__dirname, '__fixtures__', 'real-agent-rows.json.gz'))).toString(
        'utf8'
      )
    ) as CapturedRun[]

    expect(captured).toHaveLength(6)
    expect(
      captured.map(({ agent, shellPid, rows }) => ({
        agent,
        processName: resolveAgentForegroundProcessFromPs(rows, shellPid)
      }))
    ).toEqual([
      { agent: 'claude', processName: 'claude' },
      { agent: 'codex', processName: 'codex' },
      { agent: 'opencode', processName: null },
      { agent: 'gemini', processName: null },
      { agent: 'grok', processName: null },
      // The capture contains foreground Codex descendants; OMP no longer overrides them.
      { agent: 'omp', processName: 'codex' }
    ])

    const wrapperCapture = captured.find(({ agent }) => agent === 'omp')!
    const withoutCodex = wrapperCapture.rows.filter(({ command }) => command !== 'codex')
    expect(withoutCodex.length).toBeLessThan(wrapperCapture.rows.length)
    expect(resolveAgentForegroundProcessFromPs(withoutCodex, wrapperCapture.shellPid)).toBeNull()
  })
})
