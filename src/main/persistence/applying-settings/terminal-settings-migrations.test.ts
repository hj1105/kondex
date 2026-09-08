import { describe, expect, it } from 'vitest'
import { migrateAgentYoloDefaults } from './terminal-settings-migrations'

describe('migrateAgentYoloDefaults', () => {
  it('keeps newly added agent defaults manual for already migrated profiles', () => {
    const migrated = migrateAgentYoloDefaults({
      agentYoloDefaultsMigrated: true,
      agentDefaultArgs: { claude: '--dangerously-skip-permissions' },
      agentDefaultEnv: {}
    } as never)

    expect(migrated.agentDefaultArgs?.codex).toBe('')
    expect(migrated.agentDefaultArgs?.claude).toBe('--dangerously-skip-permissions')
    expect(migrated.agentDefaultEnv).toEqual({})
  })
})
