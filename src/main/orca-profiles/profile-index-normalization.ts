import {
  ORCA_PROFILE_INDEX_SCHEMA_VERSION,
  type OrcaProfileIndex,
  type OrcaProfileSummary
} from '../../shared/orca-profiles'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeProfileSummary(value: unknown): OrcaProfileSummary | null {
  if (!isObject(value)) {
    return null
  }
  const avatar = value.avatar
  if (
    !(
      typeof value.id === 'string' &&
      // Why: IDs from the on-disk index become filesystem path segments; a
      // tampered index must not be able to escape the profiles directory.
      /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value.id) &&
      typeof value.name === 'string' &&
      value.name.length > 0 &&
      (value.kind === 'local' || value.kind === 'cloud-linked') &&
      typeof value.createdAt === 'number' &&
      typeof value.updatedAt === 'number' &&
      typeof value.lastOpenedAt === 'number' &&
      isObject(avatar) &&
      avatar.kind === 'initials' &&
      typeof avatar.initials === 'string' &&
      avatar.color === 'neutral'
    )
  ) {
    return null
  }

  // Why: cloud-linked profiles were formerly stored alongside local profiles.
  // Their local projects, sessions, and browser partitions remain useful, so
  // load them as local profiles while deliberately dropping obsolete cloud
  // credentials and any other unknown legacy fields.
  return {
    id: value.id,
    name: value.name,
    avatar: { kind: 'initials', initials: avatar.initials, color: 'neutral' },
    kind: 'local',
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    lastOpenedAt: value.lastOpenedAt
  }
}

export function normalizeProfileIndex(raw: unknown): OrcaProfileIndex | null {
  if (!isObject(raw) || !Array.isArray(raw.profiles)) {
    return null
  }
  const profiles = raw.profiles
    .map(normalizeProfileSummary)
    .filter((profile): profile is OrcaProfileSummary => profile !== null)
  const activeProfileId =
    typeof raw.activeProfileId === 'string' &&
    profiles.some((profile) => profile.id === raw.activeProfileId)
      ? raw.activeProfileId
      : profiles[0]?.id
  if (!activeProfileId) {
    return null
  }
  return {
    schemaVersion: ORCA_PROFILE_INDEX_SCHEMA_VERSION,
    activeProfileId,
    profiles
  }
}
