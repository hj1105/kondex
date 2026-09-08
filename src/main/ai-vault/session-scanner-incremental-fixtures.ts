import type { AiVaultAgent } from '../../shared/ai-vault-types'
import { codexFixture } from './session-scanner-codex-fixtures'

export type IncrementalAgentFixture = {
  agent: AiVaultAgent
  fileName: string
  seedLines: string[]
  appendLines: string[]
  truncatedLines: string[]
}

function claudeLine(record: Record<string, unknown>): string {
  return JSON.stringify(record)
}

export function claudeFixture(): IncrementalAgentFixture {
  return {
    agent: 'claude',
    fileName: '11111111-2222-4333-8444-555555555555.jsonl',
    seedLines: [
      claudeLine({
        type: 'user',
        sessionId: '11111111-2222-4333-8444-555555555555',
        cwd: '/repo/app',
        timestamp: '2026-05-01T10:00:00.000Z',
        message: { role: 'user', content: 'claude seed question' }
      }),
      claudeLine({
        type: 'assistant',
        timestamp: '2026-05-01T10:00:05.000Z',
        message: {
          role: 'assistant',
          content: 'claude seed answer',
          model: 'claude-sonnet',
          usage: { input_tokens: 80, output_tokens: 30 }
        }
      })
    ],
    appendLines: [
      claudeLine({
        type: 'user',
        timestamp: '2026-05-01T10:01:00.000Z',
        message: { role: 'user', content: 'claude follow-up' }
      }),
      claudeLine({
        type: 'assistant',
        timestamp: '2026-05-01T10:01:05.000Z',
        message: {
          role: 'assistant',
          content: 'claude incremental answer',
          usage: { input_tokens: 40, output_tokens: 20 }
        }
      })
    ],
    truncatedLines: [
      claudeLine({
        type: 'user',
        sessionId: '11111111-2222-4333-8444-555555555555',
        timestamp: '2026-05-01T10:00:00.000Z',
        message: { role: 'user', content: 'claude rewritten' }
      })
    ]
  }
}

export function allIncrementalAgentFixtures(): IncrementalAgentFixture[] {
  return [claudeFixture(), codexFixture()]
}
