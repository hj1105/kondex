export type AppIconId = 'classic'

export const DEFAULT_APP_ICON_ID: AppIconId = 'classic'

export function normalizeAppIconId(value: unknown): AppIconId {
  // Why: older Orca profiles may still contain a selectable icon id. Kondex has
  // one product identity, so every persisted or incoming value converges here.
  return value === DEFAULT_APP_ICON_ID ? value : DEFAULT_APP_ICON_ID
}
