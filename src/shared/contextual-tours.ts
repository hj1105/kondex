// Historical persisted profiles and remote UI payloads can still contain these ids.
// Keep accepting them while the obsolete tour renderer itself remains removed.
export const CONTEXTUAL_TOUR_IDS = [
  'workspace-board',
  'workspace-agent-sessions',
  'browser',
  'client-hosted-browser',
  'tasks',
  'automations',
  'floating-workspace',
  'workspace-creation'
] as const

export type ContextualTourId = (typeof CONTEXTUAL_TOUR_IDS)[number]

export function isContextualTourId(value: unknown): value is ContextualTourId {
  return typeof value === 'string' && CONTEXTUAL_TOUR_IDS.includes(value as ContextualTourId)
}

export function normalizeContextualTourIds(value: unknown): ContextualTourId[] {
  if (!Array.isArray(value)) {
    return []
  }

  const seen = new Set<ContextualTourId>()
  for (const item of value) {
    if (isContextualTourId(item)) {
      seen.add(item)
    }
  }
  return [...seen]
}
