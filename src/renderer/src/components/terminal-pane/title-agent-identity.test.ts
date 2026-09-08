import { describe, expect, it } from 'vitest'
import { titleHasExplicitAgentIdentity } from './title-agent-identity'

describe('titleHasExplicitAgentIdentity', () => {
  it.each(['codex', 'claude'])(
    'recognizes %s executable titles through the shared token matcher',
    (agent) => {
      expect(titleHasExplicitAgentIdentity(`${agent}.exe ready`)).toBe(true)
      expect(titleHasExplicitAgentIdentity(`${agent}.cmd working`)).toBe(true)
    }
  )

  it.each(['codex', 'claude'])('rejects %s path and compound fragments', (agent) => {
    expect(titleHasExplicitAgentIdentity(`C:\\work\\${agent}.exe\\ready`)).toBe(false)
    expect(titleHasExplicitAgentIdentity(`${agent}-fixtures ready`)).toBe(false)
  })

  it('does not recognize retired Devin executable titles', () => {
    expect(titleHasExplicitAgentIdentity('devin.exe ready')).toBe(false)
    expect(titleHasExplicitAgentIdentity('devin.cmd working')).toBe(false)
  })
})
