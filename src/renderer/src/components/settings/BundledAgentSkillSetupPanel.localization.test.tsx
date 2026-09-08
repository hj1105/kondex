// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n/i18n'

const mocks = vi.hoisted(() => ({ install: vi.fn(), refresh: vi.fn(), changed: vi.fn() }))
vi.mock('@/hooks/useActiveProjectSkillRuntime', () => ({
  useActiveProjectSkillRuntime: () => ({ installDisabledReason: null })
}))
vi.mock('@/hooks/use-active-skill-discovery-runtime-target', () => ({
  useActiveSkillDiscoveryRuntimeTarget: () => ({
    kind: 'environment',
    environmentId: 'Orca-server: west'
  })
}))
vi.mock('@/runtime/runtime-bundled-skills-client', () => ({
  installBundledSkillsOnRuntimeTarget: mocks.install
}))
vi.mock('@/hooks/useInstalledAgentSkills', () => ({
  notifyInstalledAgentSkillsChanged: mocks.changed,
  GLOBAL_AGENT_SKILL_SOURCE_KINDS: ['home'],
  useInstalledAgentSkill: () => ({
    installed: false,
    loading: false,
    error: null,
    refresh: mocks.refresh
  })
}))
vi.mock('@/hooks/useSkillFreshness', () => ({ refreshSkillFreshness: vi.fn() }))
vi.mock('../skills/SkillFreshnessStatusPill', () => ({ SkillFreshnessStatusPill: () => null }))
import { BundledAgentSkillSetupPanel } from './BundledAgentSkillSetupPanel'

beforeEach(async () => {
  await i18n.changeLanguage('en')
  mocks.install.mockResolvedValue({
    status: 'complete',
    skills: [{ name: 'kondex-cli', status: 'installed' }]
  })
  mocks.refresh.mockResolvedValue(undefined)
})
afterEach(async () => {
  cleanup()
  vi.clearAllMocks()
  await i18n.changeLanguage('en')
})

it('switches setup copy live while retaining provider selection and the exact target', async () => {
  render(
    <BundledAgentSkillSetupPanel
      title="CLI skill"
      description="Test skill"
      skillName="kondex-cli"
    />
  )
  fireEvent.click(screen.getByRole('checkbox', { name: 'Claude' }))
  await act(async () => {
    await i18n.changeLanguage('ko')
  })
  expect(screen.getByText('에이전트 연동')).toBeTruthy()
  expect(screen.getByText(/설치 대상: Orca-server: west/)).toBeTruthy()
  expect(screen.getByRole('checkbox', { name: 'Claude' }).getAttribute('aria-checked')).toBe(
    'false'
  )
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '설치' }))
  })
  expect(mocks.install).toHaveBeenCalledExactlyOnceWith(
    { kind: 'environment', environmentId: 'Orca-server: west' },
    expect.objectContaining({
      providers: ['codex'],
      skillNames: ['kondex-cli'],
      destination: { scope: 'global', executionTarget: { kind: 'host' } }
    })
  )
  await act(async () => {
    await i18n.changeLanguage('en')
  })
  expect(screen.getByRole('button', { name: 'Re-check' })).toBeTruthy()
  expect(mocks.refresh).toHaveBeenCalledOnce()
})
