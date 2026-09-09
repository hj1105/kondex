import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { scanAiVaultSessions } from './session-scanner'
import { isolatedScanRoots } from './session-scanner-test-fixtures'

let tempRoots: string[] = []

afterEach(async () => {
  await Promise.all(tempRoots.map((root) => rm(root, { recursive: true, force: true })))
  tempRoots = []
})

function jsonLines(records: unknown[]): string {
  return records.map((record) => JSON.stringify(record)).join('\n')
}

describe('scanAiVaultSessions Codex worker sessions', () => {
  it('hides Codex worker transcripts from session history', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-ai-vault-codex-workers-'))
    tempRoots.push(root)
    // Why the shared fixture: it isolates every agent root, so a real session in
    // the developer's own home cannot list itself into this assertion.
    const roots = isolatedScanRoots(root)
    const codexSessionsDir = roots.codexSessionsDir
    await mkdir(join(codexSessionsDir, '2026', '06', '12'), { recursive: true })

    await writeFile(
      join(codexSessionsDir, '2026', '06', '12', 'rollout-user-session.jsonl'),
      jsonLines([
        {
          timestamp: '2026-06-12T10:00:00.000Z',
          type: 'session_meta',
          payload: {
            id: 'user-session',
            cwd: '/repo/app',
            thread_source: 'user'
          }
        },
        {
          timestamp: '2026-06-12T10:00:01.000Z',
          type: 'response_item',
          payload: {
            type: 'message',
            role: 'user',
            content: [{ type: 'text', text: 'Top-level Codex task' }]
          }
        }
      ])
    )

    await writeFile(
      join(codexSessionsDir, '2026', '06', '12', 'rollout-worker-session.jsonl'),
      jsonLines([
        {
          timestamp: '2026-06-12T10:01:00.000Z',
          type: 'session_meta',
          payload: {
            id: 'worker-session',
            cwd: '/repo/app',
            thread_source: 'subagent'
          }
        },
        {
          timestamp: '2026-06-12T10:01:01.000Z',
          type: 'response_item',
          payload: {
            type: 'message',
            role: 'user',
            content: [{ type: 'text', text: 'Internal worker task' }]
          }
        }
      ])
    )

    await writeFile(
      join(codexSessionsDir, '2026', '06', '12', 'rollout-legacy-worker-session.jsonl'),
      jsonLines([
        {
          timestamp: '2026-06-12T10:02:00.000Z',
          type: 'session_meta',
          payload: {
            id: 'legacy-worker-session',
            cwd: '/repo/app',
            source: {
              subagent: {
                thread_spawn: {
                  parent_thread_id: 'user-session',
                  depth: 1,
                  agent_nickname: 'Worker'
                }
              }
            }
          }
        },
        {
          timestamp: '2026-06-12T10:02:01.000Z',
          type: 'response_item',
          payload: {
            type: 'message',
            role: 'user',
            content: [{ type: 'text', text: 'Legacy internal worker task' }]
          }
        }
      ])
    )

    const result = await scanAiVaultSessions({ ...roots, platform: 'darwin' })

    expect(result.issues).toEqual([])
    expect(result.sessions.map((session) => session.sessionId)).toEqual(['user-session'])
    expect(result.sessions[0]?.title).toBe('Top-level Codex task')
  })
})
