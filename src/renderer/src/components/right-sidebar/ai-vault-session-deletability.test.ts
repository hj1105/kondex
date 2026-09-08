import { describe, expect, it } from 'vitest'
import { aiVaultSessionDeleteBlockedReason } from './ai-vault-session-deletability'

// translate() with no loaded catalog returns the English fallback, so these
// assertions pin the English copy as well as the gate order.
const NON_LOCAL = 'Only sessions on this device can be deleted.'

const localCodexSession = {
  agent: 'codex' as const,
  executionHostId: 'local' as const,
  filePath: '/home/user/.codex/sessions/log.jsonl'
}

describe('aiVaultSessionDeleteBlockedReason', () => {
  it('blocks Codex deletion because its shared session index cannot be removed by path', () => {
    expect(aiVaultSessionDeleteBlockedReason(localCodexSession)).toBe(
      "Codex sessions can't be deleted from Kondex."
    )
  })

  it('offers Delete for a directory-shaped agent (claude)', () => {
    expect(
      aiVaultSessionDeleteBlockedReason({
        agent: 'claude',
        executionHostId: 'local',
        filePath: '/home/user/.claude/projects/-proj/sess-1.jsonl'
      })
    ).toBeNull()
  })

  it('blocks ssh- and runtime-hosted sessions regardless of agent', () => {
    for (const executionHostId of ['ssh:dev-box', 'runtime:gpu-box'] as const) {
      expect(aiVaultSessionDeleteBlockedReason({ ...localCodexSession, executionHostId })).toBe(
        NON_LOCAL
      )
    }
  })

  it('prioritizes the host gate for a supported agent', () => {
    expect(
      aiVaultSessionDeleteBlockedReason({
        agent: 'claude',
        executionHostId: 'ssh:dev-box',
        filePath: '/home/user/.claude/sessions/sess-dir/log.jsonl'
      })
    ).toBe(NON_LOCAL)
  })
})
