import { describe, expect, it } from 'vitest'
import { RESUMABLE_TUI_AGENTS } from '../../../shared/agent-session-resume'
import { agentResumeHostAuthorityCapability } from './agent-resume-host-authority-capability'

describe('agentResumeHostAuthorityCapability', () => {
  it('leaves agents shipped with host authority on the generic probe', () => {
    expect(agentResumeHostAuthorityCapability('codex')).toBeUndefined()
    expect(agentResumeHostAuthorityCapability(null)).toBeUndefined()
    expect(agentResumeHostAuthorityCapability(undefined)).toBeUndefined()
  })

  it('pins the gate for every resumable agent so a new member is a deliberate decision', () => {
    // Why: silently defaulting a newly resumable agent to the generic probe is the exact skew
    // failure this module exists to prevent — the mapping must be reviewed, not inherited.
    expect(
      Object.fromEntries(
        RESUMABLE_TUI_AGENTS.map((agent) => [agent, agentResumeHostAuthorityCapability(agent)])
      )
    ).toEqual({
      claude: undefined,
      codex: undefined
    })
  })
})
