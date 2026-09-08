// @vitest-environment happy-dom
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeClientTarget } from '@/runtime/runtime-rpc-client'
const mocks = vi.hoisted(() => ({
  target: { kind: 'local' } as RuntimeClientTarget | null,
  runtime: {} as {
    installDisabledReason: string | null
    agentRuntime?: { runtime: 'wsl'; wslDistro: string }
  },
  install: vi.fn(),
  refresh: vi.fn(),
  changed: vi.fn(),
  freshness: vi.fn(),
  discovery: vi.fn()
}))
vi.mock('@/hooks/useActiveProjectSkillRuntime', () => ({
  useActiveProjectSkillRuntime: () => mocks.runtime
}))
vi.mock('@/hooks/use-active-skill-discovery-runtime-target', () => ({
  useActiveSkillDiscoveryRuntimeTarget: () => mocks.target
}))
vi.mock('@/runtime/runtime-bundled-skills-client', () => ({
  installBundledSkillsOnRuntimeTarget: mocks.install
}))
vi.mock('@/hooks/useInstalledAgentSkills', () => ({
  notifyInstalledAgentSkillsChanged: mocks.changed,
  GLOBAL_AGENT_SKILL_SOURCE_KINDS: ['home'],
  useInstalledAgentSkill: mocks.discovery
}))
vi.mock('@/hooks/useSkillFreshness', () => ({ refreshSkillFreshness: mocks.freshness }))
vi.mock('../skills/SkillFreshnessStatusPill', () => ({
  SkillFreshnessStatusPill: ({ skillName }: { skillName: string }) => (
    <span data-testid="freshness">{skillName}</span>
  )
}))
import { BundledAgentSkillSetupPanel } from './BundledAgentSkillSetupPanel'

let element: HTMLDivElement
let root: Root
function render(props: Partial<ComponentProps<typeof BundledAgentSkillSetupPanel>> = {}) {
  root.render(
    <BundledAgentSkillSetupPanel
      title="Computer Use"
      description="Desktop skill"
      skillName="kondex-computer-use"
      {...props}
    />
  )
}
function installButton() {
  return [...element.querySelectorAll('button')].find((button) =>
    /Install|Update/.test(button.textContent ?? '')
  )!
}
beforeEach(async () => {
  vi.resetAllMocks()
  mocks.target = { kind: 'local' }
  mocks.runtime = { installDisabledReason: null }
  mocks.refresh.mockResolvedValue(true)
  mocks.discovery.mockReturnValue({
    installed: false,
    loading: false,
    error: null,
    refresh: mocks.refresh
  })
  mocks.install.mockResolvedValue({
    status: 'complete',
    skills: [{ name: 'kondex-computer-use', status: 'installed' }]
  })
  element = document.createElement('div')
  document.body.append(element)
  root = createRoot(element)
  await act(async () => render())
})
afterEach(async () => {
  await act(async () => root.unmount())
  element.remove()
})
describe('native bundled skill setup', () => {
  it('installs the canonical skill with explicit providers and rechecks disk state', async () => {
    await act(async () => installButton().click())
    expect(mocks.install).toHaveBeenCalledExactlyOnceWith(
      { kind: 'local' },
      expect.objectContaining({
        skillNames: ['kondex-computer-use'],
        providers: ['codex', 'claude'],
        destination: { scope: 'global', executionTarget: { kind: 'host' } }
      })
    )
    expect(mocks.refresh).toHaveBeenCalledOnce()
    expect(mocks.discovery).toHaveBeenCalledWith('kondex-computer-use', expect.anything())
    expect(element.textContent).not.toContain('npx')
    expect(element.textContent).toContain('Not installed')
  })
  it('keeps the selected WSL distro and permits choosing only Codex', async () => {
    mocks.runtime = {
      installDisabledReason: null,
      agentRuntime: { runtime: 'wsl', wslDistro: 'Ubuntu' }
    }
    await act(async () => render())
    await act(async () => (element.querySelectorAll('[role="checkbox"]')[1] as HTMLElement).click())
    await act(async () => installButton().click())
    expect(mocks.install).toHaveBeenCalledWith(
      { kind: 'local' },
      expect.objectContaining({
        providers: ['codex'],
        destination: { scope: 'global', executionTarget: { kind: 'wsl', distro: 'Ubuntu' } }
      })
    )
  })
  it('does not pass the client WSL target to a paired runtime', async () => {
    mocks.target = { kind: 'environment', environmentId: 'linux-peer' }
    mocks.runtime = {
      installDisabledReason: null,
      agentRuntime: { runtime: 'wsl', wslDistro: 'Ubuntu' }
    }
    await act(async () => render())
    await act(async () => installButton().click())
    expect(mocks.install).toHaveBeenCalledWith(
      mocks.target,
      expect.objectContaining({
        destination: { scope: 'global', executionTarget: { kind: 'host' } }
      })
    )
  })
  it('disables installation while runtime ownership is unresolved', async () => {
    mocks.target = null
    await act(async () => render())
    expect(installButton().disabled).toBe(true)
    await act(async () => installButton().click())
    expect(mocks.install).not.toHaveBeenCalled()
  })
  it('prevents double submission and does not show an old host failure after switching', async () => {
    let reject!: (error: Error) => void
    mocks.install.mockImplementation(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail
        })
    )
    await act(async () => {
      installButton().click()
      installButton().click()
    })
    expect(mocks.install).toHaveBeenCalledOnce()
    expect(installButton().disabled).toBe(true)
    mocks.target = { kind: 'environment', environmentId: 'next-peer' }
    await act(async () => render())
    await act(async () => reject(new Error('Previous host failed')))
    expect(element.textContent).not.toContain('Previous host failed')
    expect(installButton().disabled).toBe(false)
  })
  it('shows conflicts instead of claiming success', async () => {
    mocks.install.mockResolvedValue({
      status: 'partial',
      skills: [{ name: 'kondex-computer-use', status: 'kept-local' }]
    })
    await act(async () => installButton().click())
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('kept-local')
    expect(mocks.refresh).toHaveBeenCalledOnce()
  })
  it('pins an explicitly local install even while the active project belongs to a peer', async () => {
    mocks.target = { kind: 'environment', environmentId: 'peer' }
    mocks.runtime = {
      installDisabledReason: 'Active project is unavailable',
      agentRuntime: { runtime: 'wsl', wslDistro: 'Ubuntu' }
    }
    const refresh = vi.fn().mockResolvedValue(true)
    const onBeforeInstall = vi.fn()
    await act(async () =>
      render({
        targetOverride: { kind: 'local' },
        runtimeOverride: {
          agentRuntime: { runtime: 'host', label: 'This device' },
          installDisabledReason: null
        },
        discoveryState: { installed: true, loading: false, error: null, refresh },
        onBeforeInstall
      })
    )
    expect(element.querySelector('[data-testid="freshness"]')).not.toBeNull()
    expect(mocks.discovery).toHaveBeenLastCalledWith(
      'kondex-computer-use',
      expect.objectContaining({ enabled: false })
    )
    await act(async () => installButton().click())
    expect(onBeforeInstall).toHaveBeenCalledOnce()
    expect(mocks.install).toHaveBeenCalledWith(
      { kind: 'local' },
      expect.objectContaining({
        destination: { scope: 'global', executionTarget: { kind: 'host' } }
      })
    )
    expect(onBeforeInstall.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.install.mock.invocationCallOrder[0]
    )
    expect(refresh).toHaveBeenCalledOnce()
    expect(mocks.refresh).not.toHaveBeenCalled()
    expect(mocks.changed).toHaveBeenCalledOnce()
  })
  it('keeps explicitly selected WSL discovery and installation together', async () => {
    await act(async () =>
      render({
        runtimeOverride: {
          agentRuntime: { runtime: 'wsl', wslDistro: 'Debian', label: 'WSL Debian' },
          discoveryTarget: { runtime: 'wsl', wslDistro: 'Debian' },
          installDisabledReason: null
        }
      })
    )
    expect(mocks.discovery).toHaveBeenLastCalledWith(
      'kondex-computer-use',
      expect.objectContaining({ discoveryTarget: { runtime: 'wsl', wslDistro: 'Debian' } })
    )
    await act(async () => installButton().click())
    expect(mocks.install).toHaveBeenCalledWith(
      { kind: 'local' },
      expect.objectContaining({
        destination: { scope: 'global', executionTarget: { kind: 'wsl', distro: 'Debian' } }
      })
    )
  })
  it('does not register the client CLI or read local freshness for a paired installation', async () => {
    mocks.target = { kind: 'environment', environmentId: 'peer' }
    const onBeforeInstall = vi.fn()
    await act(async () =>
      render({
        onBeforeInstall,
        discoveryState: { installed: true, loading: false, error: null, refresh: mocks.refresh }
      })
    )
    expect(element.querySelector('[data-testid="freshness"]')).toBeNull()
    await act(async () => installButton().click())
    expect(onBeforeInstall).not.toHaveBeenCalled()
    expect(mocks.install).toHaveBeenCalledWith(mocks.target, expect.anything())
    expect(mocks.freshness).not.toHaveBeenCalled()
  })
  it('does not install after a failed prerequisite and releases its running state', async () => {
    const onBeforeInstall = vi.fn().mockRejectedValue(new Error('CLI unavailable'))
    await act(async () => render({ onBeforeInstall }))
    await act(async () => installButton().click())
    expect(mocks.install).not.toHaveBeenCalled()
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('CLI unavailable')
    expect(installButton().disabled).toBe(false)
  })
  it('reports a rescan failure without trapping the action in running state', async () => {
    mocks.refresh.mockRejectedValue(new Error('Inventory unavailable'))
    await act(async () => installButton().click())
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('Inventory unavailable')
    expect(installButton().disabled).toBe(false)
  })
  it.each(['local', 'wsl', 'peer'] as const)(
    'only rechecks local freshness for a host header: %s',
    async (kind) => {
      if (kind === 'peer') {
        mocks.target = { kind: 'environment', environmentId: 'peer' }
      }
      if (kind === 'wsl') {
        mocks.runtime.agentRuntime = { runtime: 'wsl', wslDistro: 'Ubuntu' }
      }
      await act(async () =>
        render({
          discoveryState: { installed: true, loading: false, error: null, refresh: mocks.refresh }
        })
      )
      expect(Boolean(element.querySelector('[data-testid="freshness"]'))).toBe(kind === 'local')
      const recheck = [...element.querySelectorAll('button')].find((button) =>
        button.textContent?.includes('Re-check')
      )!
      await act(async () => recheck.click())
      expect(mocks.refresh).toHaveBeenCalledOnce()
      expect(mocks.freshness).toHaveBeenCalledTimes(kind === 'local' ? 1 : 0)
    }
  )
  it('shows manual recheck errors instead of leaving an unhandled rejection', async () => {
    mocks.refresh.mockRejectedValue(new Error('Scan denied'))
    const recheck = [...element.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Re-check')
    )!
    await act(async () => recheck.click())
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('Scan denied')
  })
})
