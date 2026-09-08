import { fetchClaudeRateLimits } from '../claude-fetcher'
import { fetchCodexRateLimits } from '../codex-fetcher'
import { RateLimitServiceFetchPolicy } from './service-fetch-policy'
import type {
  ClaudeRuntimeAuthPreparation,
  InternalRateLimitState,
  NormalizedClaudeAccountSelectionTarget,
  NormalizedCodexAccountSelectionTarget,
  ProviderRateLimits
} from './service-types'

export type FetchAllCyclePrepared = {
  claudeTarget: NormalizedClaudeAccountSelectionTarget
  claudeGeneration: number
  claudeProvenance: string
  codexTarget: NormalizedCodexAccountSelectionTarget
  previousState: InternalRateLimitState
  codexFetchGated: boolean
  codexStateBeforeFetch: ProviderRateLimits | null
  codexProvenance: string | null
  codexGeneration: number
  claudeFetchGated: boolean
  results: [PromiseSettledResult<ProviderRateLimits>, PromiseSettledResult<ProviderRateLimits>]
}

export abstract class RateLimitServiceFullCyclePreparation extends RateLimitServiceFetchPolicy {
  protected async prepareFetchAllCycle(
    signal: AbortSignal,
    options?: { force?: boolean }
  ): Promise<FetchAllCyclePrepared | null> {
    if (signal.aborted) {
      return null
    }

    const claudeTarget = this.claudeFetchTarget
    const claudeGeneration = this.claudeFetchGeneration
    const claudeAuthPreparation: ClaudeRuntimeAuthPreparation | undefined =
      await this.claudeAuthPreparationResolver?.(claudeTarget)
    if (signal.aborted) {
      return null
    }
    this.rememberClaudeAuthSnapshot(claudeAuthPreparation, claudeGeneration, claudeTarget)
    const claudeProvenance = claudeAuthPreparation?.provenance ?? 'system'

    const codexTarget = this.codexFetchTarget
    const previousState = this.state
    const codexHome = this.resolveCodexHome(codexTarget)
    const codexFetchGated = codexHome.skip
    const codexHomePath = codexHome.homePath
    const codexStateBeforeFetch =
      previousState.codex?.status === 'fetching' ? null : previousState.codex
    const codexProvenance = codexFetchGated
      ? null
      : this.getCodexProvenance(codexTarget, codexHomePath)
    const codexGeneration = this.codexFetchGeneration
    const claudeFetchGated =
      !options?.force && this.shouldSkipAutomatedClaudeFetch(previousState.claude)

    this.updateState({
      claude: claudeFetchGated
        ? previousState.claude
        : this.withFetchingStatus(previousState.claude, 'claude'),
      codex: codexFetchGated
        ? codexStateBeforeFetch
        : this.withFetchingStatus(previousState.codex, 'codex')
    })

    const missingWslCodexHome =
      codexFetchGated || codexHomePath ? null : this.getMissingWslCodexHomeResult(codexTarget)
    const results = (await Promise.allSettled([
      claudeFetchGated
        ? Promise.resolve(previousState.claude as ProviderRateLimits)
        : fetchClaudeRateLimits({
            authPreparation: claudeAuthPreparation,
            allowPtyFallback: this.shouldAllowClaudePtyFallback(claudeAuthPreparation),
            allowUsagePanelSupplement: this.shouldAllowClaudeUsagePanelSupplement(),
            networkProxySettings: this.networkProxySettingsResolver?.(),
            signal
          }),
      codexFetchGated
        ? Promise.resolve(previousState.codex as ProviderRateLimits)
        : (missingWslCodexHome ??
          fetchCodexRateLimits({
            codexHomePath,
            allowPtyFallback: this.shouldAllowCodexPtyFallback(),
            signal
          }))
    ])) as FetchAllCyclePrepared['results']

    if (signal.aborted) {
      return null
    }
    return {
      claudeTarget,
      claudeGeneration,
      claudeProvenance,
      codexTarget,
      previousState,
      codexFetchGated,
      codexStateBeforeFetch,
      codexProvenance,
      codexGeneration,
      claudeFetchGated,
      results
    }
  }
}
