import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { BrowserUseSkillStep } from './BrowserUseSkillStep'

const capturedPanel = vi.hoisted(() => ({
  props: null as null | Record<string, unknown>
}))

vi.mock('./BundledAgentSkillSetupPanel', () => ({
  BundledAgentSkillSetupPanel: (props: Record<string, unknown>) => {
    capturedPanel.props = props
    return <div data-testid="browser-use-skill-step" />
  }
}))

describe('BrowserUseSkillStep', () => {
  it('uses only the canonical CLI skill and preserves observed installation state', () => {
    renderToStaticMarkup(
      <BrowserUseSkillStep
        skillDetected
        skillLoading={false}
        skillError={null}
        onRecheck={vi.fn()}
      />
    )

    expect(capturedPanel.props).toEqual(
      expect.objectContaining({
        skillName: 'kondex-cli',
        discoveryState: expect.objectContaining({ installed: true })
      })
    )
  })
})
