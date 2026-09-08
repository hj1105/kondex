import { ORCA_BROWSER_PARTITION } from './constants'
import type { ExecutionHostId } from './execution-host'

export const ORCA_PROFILE_INDEX_SCHEMA_VERSION = 1
export const DEFAULT_LOCAL_ORCA_PROFILE_ID = 'local-default'
export const DEFAULT_LOCAL_ORCA_PROFILE_NAME = 'Personal'
const LEGACY_ORCA_BROWSER_SESSION_PARTITION_PREFIX = 'persist:orca-browser-session-'

export type OrcaProfileAvatar = {
  kind: 'initials'
  initials: string
  color: 'neutral'
}

export type OrcaProfileKind = 'local'

export type OrcaProfileSummary = {
  id: string
  name: string
  avatar: OrcaProfileAvatar
  kind: OrcaProfileKind
  createdAt: number
  updatedAt: number
  lastOpenedAt: number
}

export type OrcaProfileIndex = {
  schemaVersion: number
  activeProfileId: string
  profiles: OrcaProfileSummary[]
}

export type OrcaProfileListState = {
  activeProfileId: string
  profiles: OrcaProfileSummary[]
}

export type OrcaProfileListResult = OrcaProfileListState & {
  // Why: gates the full multi-profile switcher UI; default builds show a
  // single-profile account menu instead.
  multiProfileUi: boolean
}

export type CreateLocalOrcaProfileArgs = {
  name?: string
}

export type CreateLocalOrcaProfileResult = OrcaProfileListState & {
  profile: OrcaProfileSummary
}

export type SwitchOrcaProfileArgs = {
  profileId: string
}

export type SwitchOrcaProfileResult = {
  status: 'already-active' | 'relaunching'
}

export type TransferOrcaProfileProjectMode = 'move' | 'copy'

export type TransferOrcaProfileProjectArgs = {
  sourceProfileId: string
  targetProfileId: string
  repoId: string
  mode: TransferOrcaProfileProjectMode
}

export type FindOrcaProfileProjectsByPathArgs = {
  path: string
  connectionId?: string | null
  executionHostId?: ExecutionHostId | null
  excludeProfileId?: string | null
}

export type OrcaProfileProjectPresence = {
  profileId: string
  profileName: string
  profileKind: OrcaProfileKind
  repoId: string
  repoName: string
}

export type FindOrcaProfileProjectsByPathResult = {
  projects: OrcaProfileProjectPresence[]
}

export type TransferOrcaProfileProjectResult =
  | {
      status: 'transferred'
      mode: TransferOrcaProfileProjectMode
      sourceProfileId: string
      targetProfileId: string
      sourceRepoId: string
      targetRepoId: string
      targetProjectId: string | null
      willRelaunch?: boolean
    }
  | {
      status: 'duplicate-target'
      sourceProfileId: string
      targetProfileId: string
      sourceRepoId: string
      duplicateRepoId: string
    }

export function createDefaultLocalOrcaProfile(now: number): OrcaProfileSummary {
  return {
    id: DEFAULT_LOCAL_ORCA_PROFILE_ID,
    name: DEFAULT_LOCAL_ORCA_PROFILE_NAME,
    avatar: { kind: 'initials', initials: 'P', color: 'neutral' },
    kind: 'local',
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now
  }
}

function profilePartitionHash(value: string): string {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function getOrcaProfileBrowserPartitionSegment(profileId: string): string {
  const safe = profileId.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 48) || 'profile'
  return `${safe}-${profilePartitionHash(profileId)}`
}

export function getOrcaProfileBrowserDefaultPartition(profileId: string): string {
  if (profileId === DEFAULT_LOCAL_ORCA_PROFILE_ID) {
    return ORCA_BROWSER_PARTITION
  }
  return `persist:orca-profile-${getOrcaProfileBrowserPartitionSegment(profileId)}-browser-default`
}

export function getOrcaProfileBrowserSessionPartition(
  profileId: string,
  browserSessionProfileId: string
): string {
  if (profileId === DEFAULT_LOCAL_ORCA_PROFILE_ID) {
    return `${LEGACY_ORCA_BROWSER_SESSION_PARTITION_PREFIX}${browserSessionProfileId}`
  }
  return `persist:orca-profile-${getOrcaProfileBrowserPartitionSegment(
    profileId
  )}-browser-session-${browserSessionProfileId}`
}
