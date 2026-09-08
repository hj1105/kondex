import { RateLimitServiceFullCyclePreparation } from './service-full-cycle-preparation'
import type { ProviderRateLimits } from './service-types'

function failedProviderResult(
  provider: ProviderRateLimits['provider'],
  reason: unknown
): ProviderRateLimits {
  return {
    provider,
    session: null,
    weekly: null,
    updatedAt: Date.now(),
    error: reason instanceof Error ? reason.message : 'Unknown error',
    status: 'error'
  }
}

export abstract class RateLimitServiceFullCycleApplication extends RateLimitServiceFullCyclePreparation {
  protected async runFetchAllCycle(
    signal: AbortSignal,
    options?: { force?: boolean }
  ): Promise<void> {
    const prepared = await this.prepareFetchAllCycle(signal, options)
    if (!prepared) {
      return
    }
    const {
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
      results: [claudeResult, codexResult]
    } = prepared

    const claude =
      claudeResult.status === 'fulfilled'
        ? claudeResult.value
        : failedProviderResult('claude', claudeResult.reason)
    const codex =
      codexResult.status === 'fulfilled'
        ? codexResult.value
        : failedProviderResult('codex', codexResult.reason)

    const latestCodexHome = this.resolveCodexHome(codexTarget)
    const latestClaudeAuthPreparation = await this.claudeAuthPreparationResolver?.(claudeTarget)
    if (signal.aborted) {
      return
    }
    const latestClaudeProvenance = latestClaudeAuthPreparation?.provenance ?? 'system'
    const shouldApplyCodex =
      !codexFetchGated &&
      !latestCodexHome.skip &&
      codexGeneration === this.codexFetchGeneration &&
      codexProvenance === this.getCodexProvenance(codexTarget, latestCodexHome.homePath)
    const codexBecameUnavailable =
      !codexFetchGated && latestCodexHome.skip && codexGeneration === this.codexFetchGeneration
    const shouldApplyClaude =
      !claudeFetchGated &&
      claudeGeneration === this.claudeFetchGeneration &&
      claudeProvenance === latestClaudeProvenance &&
      this.isSameClaudeTarget(claudeTarget, this.claudeFetchTarget)

    if (shouldApplyClaude) {
      this.trackActiveFailureStreak('claude', claude)
    }
    if (shouldApplyCodex) {
      this.trackActiveFailureStreak('codex', codex)
    }
    this.updateState({
      claude: shouldApplyClaude
        ? this.resolveClaudeFetchApply(claude, previousState.claude)
        : this.state.claude,
      codex: shouldApplyCodex
        ? this.applyStalePolicy(codex, previousState.codex)
        : codexBecameUnavailable
          ? codexStateBeforeFetch
          : this.state.codex
    })
  }
}
