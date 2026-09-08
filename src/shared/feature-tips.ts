// Historical persisted profiles and remote UI payloads can still contain these ids.
// Keep accepting them while the obsolete feature-tip renderer itself remains removed.
export const FEATURE_TIP_IDS = ['orca-cli', 'cmd-j-palette'] as const

export type FeatureTipId = (typeof FEATURE_TIP_IDS)[number]

export function isFeatureTipId(value: unknown): value is FeatureTipId {
  return typeof value === 'string' && FEATURE_TIP_IDS.includes(value as FeatureTipId)
}

export function normalizeFeatureTipIds(value: unknown): FeatureTipId[] {
  if (!Array.isArray(value)) {
    return []
  }

  const seen = new Set<FeatureTipId>()
  for (const item of value) {
    if (isFeatureTipId(item)) {
      seen.add(item)
    }
  }
  return [...seen]
}
