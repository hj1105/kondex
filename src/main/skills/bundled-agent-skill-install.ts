import { randomUUID } from 'node:crypto'
import { stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import type { SkillBundleSkillResult } from '../../shared/skill-bundle-install-contract'
import { isSkillInstallProviderId } from '../../shared/skill-install-providers'
import {
  KONDEX_BUNDLED_SKILL_PACKAGE_ID,
  withBundledAgentSkillArchive
} from './bundled-agent-skill-archive'
import { installSkillBundle } from './skill-bundle-install-service'
import { readSkillInstallReceipt } from './skill-install-provenance'
import type { SkillProviderRootOverrides } from './skill-provider-destinations'
import { discoverSkills } from './discovery'

export type BundledAgentSkillInstallInput = {
  verb: 'install' | 'update'
  skillNames: readonly string[]
  scope: 'global' | 'workspace'
  homeDirectory: string
  workspaceDirectory: string
  stateDirectory: string
  providers: readonly string[]
  providerRootOverrides?: SkillProviderRootOverrides
  signal?: AbortSignal
}

export async function mutateBundledAgentSkills(input: BundledAgentSkillInstallInput) {
  input.signal?.throwIfAborted()
  if (input.providers.some((provider) => !isSkillInstallProviderId(provider))) {
    throw new Error('bundled-skill-provider-invalid')
  }
  const scopeRoot = resolve(
    input.scope === 'global' ? input.homeDirectory : input.workspaceDirectory
  )
  const canonicalRoot = join(scopeRoot, '.agents', 'skills')
  const stateDirectory = join(input.stateDirectory, 'skill-installs')
  return withBundledAgentSkillArchive(input.skillNames, async (bundle) => {
    const results: SkillBundleSkillResult[] = []
    const skippedSkills: string[] = []
    let complete = true
    for (const skill of bundle.manifest.skills) {
      input.signal?.throwIfAborted()
      let providers = input.providers
      let providerRootOverrides = input.providerRootOverrides
      if (input.verb === 'update') {
        const canonicalPath = join(canonicalRoot, skill.name)
        const receipt = await readSkillInstallReceipt(stateDirectory, canonicalPath)
        const present = await stat(join(canonicalPath, 'SKILL.md')).then(
          (value) => value.isFile(),
          (error: NodeJS.ErrnoException) => {
            if (error.code === 'ENOENT') {
              return false
            }
            throw error
          }
        )
        if (!present || receipt?.packageId !== KONDEX_BUNDLED_SKILL_PACKAGE_ID) {
          skippedSkills.push(skill.name)
          continue
        }
        // Updates retain the receipt's targets, never detect and add new agent homes.
        providers =
          receipt.providers ??
          receipt.placements.map((placement) => placement.provider).filter(isSkillInstallProviderId)
        providerRootOverrides = Object.fromEntries(
          receipt.placements
            .filter((placement) => isSkillInstallProviderId(placement.provider))
            .map((placement) => [placement.provider, dirname(placement.path)])
        )
      }
      const result = await installSkillBundle({
        operationId: randomUUID(),
        archivePath: bundle.archivePath,
        packageId: bundle.manifest.packageId,
        versionId: bundle.manifest.versionId,
        bundleDigest: bundle.manifest.bundleDigest,
        selectedSkillIds: [skill.id],
        expectedArchiveSha256: bundle.archiveSha256,
        scope: input.scope,
        homeDirectory: input.homeDirectory,
        workspaceDirectory: input.workspaceDirectory,
        orcaStateDirectory: input.stateDirectory,
        detectedProviders: providers,
        providerRootOverrides,
        signal: input.signal,
        // CLI JSON owns stdout; inventory diagnostics belong to stderr.
        discover: () =>
          discoverSkills({
            homeDir: input.homeDirectory,
            repos: [],
            refresh: true,
            ...(input.scope === 'workspace'
              ? { cwd: input.workspaceDirectory }
              : { includeCwd: false }),
            providerRootOverrides,
            onScanSummary: (message) => {
              process.stderr.write(`${message}\n`)
            }
          }),
        destinationIdentity: `${input.scope}:${scopeRoot}`,
        hostIdentity: 'local'
      })
      results.push(...result.skills)
      complete &&= result.status === 'complete'
    }
    return {
      status: complete ? ('complete' as const) : ('partial' as const),
      skills: results,
      skippedSkills
    }
  })
}
