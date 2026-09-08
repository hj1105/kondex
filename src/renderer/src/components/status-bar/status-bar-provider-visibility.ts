import type { ProviderRateLimits } from '../../../../shared/rate-limit-types'
import type { GlobalSettings } from '../../../../shared/global-settings-types'

export type UsageProviderSettings = Pick<
  GlobalSettings,
  'codexManagedAccounts' | 'claudeManagedAccounts'
>

type UsageProviderSnapshots = {
  claude: ProviderRateLimits | null | undefined
  codex: ProviderRateLimits | null | undefined
}

type UsageProviderId = ProviderRateLimits['provider']

function hasUsageData(provider: ProviderRateLimits): boolean {
  return Boolean(
    provider.session ||
    provider.weekly ||
    provider.fableWeekly ||
    provider.monthly ||
    (provider.buckets && provider.buckets.length > 0)
  )
}

function isProviderSnapshotPending(provider: ProviderRateLimits | null | undefined): boolean {
  return provider == null || (provider.status === 'fetching' && !hasUsageData(provider))
}

export function isProviderConfigured(
  provider: ProviderRateLimits | null | undefined
): provider is ProviderRateLimits {
  if (provider == null || provider.status === 'unavailable') {
    return false
  }
  return provider.status !== 'fetching' || hasUsageData(provider)
}

export function hasUsageProviderSettings(
  settings: Partial<UsageProviderSettings> | null | undefined
): boolean {
  return Boolean(
    (settings?.codexManagedAccounts?.length ?? 0) > 0 ||
    (settings?.claudeManagedAccounts?.length ?? 0) > 0
  )
}

export function hasUsageProviderSettingsForProvider(
  providerId: UsageProviderId,
  settings: Partial<UsageProviderSettings> | null | undefined
): boolean {
  if (providerId === 'claude') {
    return (settings?.claudeManagedAccounts?.length ?? 0) > 0
  }
  return (settings?.codexManagedAccounts?.length ?? 0) > 0
}

function createPendingProviderSnapshot(provider: UsageProviderId): ProviderRateLimits {
  return {
    provider,
    session: null,
    weekly: null,
    updatedAt: 0,
    error: null,
    status: 'fetching'
  }
}

export function getVisibleUsageProvider(
  providerId: UsageProviderId,
  provider: ProviderRateLimits | null | undefined,
  settings: Partial<UsageProviderSettings> | null | undefined
): ProviderRateLimits | null {
  if (isProviderConfigured(provider)) {
    return provider
  }
  if (!hasUsageProviderSettingsForProvider(providerId, settings)) {
    return null
  }
  return provider ?? createPendingProviderSnapshot(providerId)
}

export function isUsageEmptyState(
  providers: UsageProviderSnapshots,
  settings: Partial<UsageProviderSettings> | null | undefined
): boolean {
  if (!settings) {
    return false
  }
  if (isProviderSnapshotPending(providers.claude) || isProviderSnapshotPending(providers.codex)) {
    return false
  }
  return (
    !hasUsageProviderSettings(settings) &&
    !isProviderConfigured(providers.claude) &&
    !isProviderConfigured(providers.codex)
  )
}
