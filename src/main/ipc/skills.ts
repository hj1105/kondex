import { app, BrowserWindow } from 'electron'
import { homedir } from 'node:os'
import type { Store } from '../persistence'
import type { OrcaRuntimeService } from '../runtime/orca-runtime'
import {
  SkillDiscoveryTargetSchema,
  type SkillDiscoveryResult,
  type SkillDiscoveryTarget
} from '../../shared/skills'
import type {
  SkillFreshnessInventory,
  SkillFreshnessStatus,
  SkillUpdateRun,
  SkillUpdateStartResult
} from '../../shared/skill-freshness'
import { inventorySkillFreshness } from '../skills/skill-freshness-inventory'
import { SkillUpdateRunner } from '../skills/skill-update-run'
import { mutateBundledAgentSkills } from '../skills/bundled-agent-skill-install'
import { readBundledSkillUpdateRegistrations } from '../skills/bundled-skill-update-registration'
import {
  clearSkillDiscoveryCaches,
  discoverSkillsOnTarget,
  resolveSkillDiscoveryTarget
} from '../skills/skill-discovery-target'
import { handleMainWindowSkillIpc } from './skill-ipc-main-window'

export function registerSkillsHandlers(store: Store, runtime?: OrcaRuntimeService): void {
  const discover = async (target?: SkillDiscoveryTarget): Promise<SkillDiscoveryResult> => {
    const parsedTarget = target ? SkillDiscoveryTargetSchema.parse(target) : undefined
    const resolvedTarget = resolveSkillDiscoveryTarget(parsedTarget)
    return discoverSkillsOnTarget(resolvedTarget, store.getRepos(), {
      providerRootOverrides: await runtime?.resolveSkillDiscoveryProviderRoots(resolvedTarget),
      refresh: parsedTarget?.refresh === true
    })
  }
  const scanInventory = (): Promise<SkillFreshnessInventory> =>
    // Why: the update command targets this machine's global homes. WSL and SSH
    // inventories stay out until their installer rail has an equivalent proof.
    inventorySkillFreshness({
      currentAppVersion: app.getVersion(),
      stateDirectory: app.getPath('userData'),
      repos: store.getRepos()
    })

  const unverifiedNames = async (names: string[], allowed: readonly SkillFreshnessStatus[]) => {
    const [inventory, registrations] = await Promise.all([
      scanInventory(),
      readBundledSkillUpdateRegistrations(names, { stateDirectory: app.getPath('userData') })
    ])
    return names.filter(
      (name) =>
        !registrations.has(name) ||
        !inventory.installations.some(
          (entry) =>
            entry.name === name &&
            entry.topology === 'canonical-copy' &&
            allowed.includes(entry.status)
        )
    )
  }
  const runner = new SkillUpdateRunner({
    updateSkills: async (names, signal) => {
      const skippedSkills = await unverifiedNames(names, ['current', 'outdated'])
      signal.throwIfAborted()
      const selected = names.filter((name) => !skippedSkills.includes(name))
      if (!selected.length) {
        return { status: 'complete', skills: [], skippedSkills }
      }
      const result = await mutateBundledAgentSkills({
        verb: 'update',
        skillNames: selected,
        signal,
        scope: 'global',
        homeDirectory: homedir(),
        workspaceDirectory: homedir(),
        stateDirectory: app.getPath('userData'),
        providers: []
      })
      return { ...result, skippedSkills: [...skippedSkills, ...result.skippedSkills] }
    },
    // Why: per-skill outcomes come from re-hashing what is actually on disk, not
    // from scraping stdout.
    rescanOutdatedNames: async (names) => {
      // Why: the run just rewrote skill packages on this host. Clients that never
      // send `refresh` (older builds) would otherwise read a pre-run scan.
      clearSkillDiscoveryCaches()
      return unverifiedNames(names, ['current'])
    },
    onState: (run: SkillUpdateRun) => {
      for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) {
          window.webContents.send('skills:updateRun', run)
        }
      }
    }
  })

  handleMainWindowSkillIpc(
    'skills:discover',
    async (_event, target?: SkillDiscoveryTarget): Promise<SkillDiscoveryResult> => discover(target)
  )

  handleMainWindowSkillIpc(
    'skills:freshnessInventory',
    async (): Promise<SkillFreshnessInventory> => {
      return scanInventory()
    }
  )

  handleMainWindowSkillIpc(
    'skills:startUpdateRun',
    async (_event, names: string[]): Promise<SkillUpdateStartResult> => {
      const { BUNDLED_SKILL_GUIDES } = await import('../../cli/bundled-skill-guides.js')
      const supported = new Set<string>(BUNDLED_SKILL_GUIDES.map((guide) => guide.name))
      if (!Array.isArray(names) || names.some((name) => !supported.has(name))) {
        return { started: false, reason: 'invalid-names' }
      }
      return runner.start(Array.isArray(names) ? names : [])
    }
  )

  handleMainWindowSkillIpc('skills:cancelUpdateRun', async (): Promise<void> => {
    runner.cancel()
  })

  handleMainWindowSkillIpc('skills:acknowledgeUpdateRun', async (): Promise<void> => {
    runner.acknowledge()
  })

  handleMainWindowSkillIpc('skills:getUpdateRun', async (): Promise<SkillUpdateRun> => {
    return runner.getState()
  })
}
