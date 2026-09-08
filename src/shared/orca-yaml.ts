import { parseDocument } from 'yaml'
import type { OrcaDefaultTabTemplate, OrcaHooks } from './orca-yaml-hook-types'
import {
  isOrcaYamlFieldWithinLimit,
  isOrcaYamlTextWithinLimit,
  MAX_ORCA_YAML_ALIAS_COUNT,
  MAX_ORCA_YAML_COLLECTION_ENTRIES
} from './orca-yaml-file-limit'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asTrimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string' || !isOrcaYamlFieldWithinLimit(value)) {
    return undefined
  }
  const trimmed = value.trim()
  return trimmed || undefined
}

const DEFAULT_TAB_COLOR_RE = /^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/
// Why: bound the work one repo file can request; entries beyond this are ignored.
const MAX_SHARED_DIRECTORIES = 100

/** Normalize `worktree.sharedDirectories` into deduped repo-root-relative paths.
 *  `\` becomes `/`, a `./` prefix and trailing `/` are stripped. Absolute paths,
 *  `..` traversal and `.git` are dropped here so callers get only safe entries.
 *
 *  Entries that would still need collapsing (`apps/./web`) are dropped rather
 *  than rewritten: `resolve()` collapses them when the symlink is created, but
 *  Git reports the collapsed path, so every later comparison against the stored
 *  entry would miss and the link would look like permanent untracked work. */
function normalizeSharedDirectories(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  const seen = new Set<string>()
  for (const entry of value.slice(0, MAX_SHARED_DIRECTORIES)) {
    const raw = asTrimmedString(entry)
    if (!raw) {
      continue
    }
    const normalized = raw.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '')
    const segments = normalized.split('/')
    if (
      !normalized ||
      normalized.startsWith('/') ||
      /^[a-zA-Z]:/.test(normalized) ||
      segments.includes('..') ||
      segments.includes('.') ||
      segments.includes('') ||
      segments.includes('.git')
    ) {
      continue
    }
    seen.add(normalized)
  }
  return Array.from(seen)
}

function normalizeDefaultTabs(value: unknown): OrcaDefaultTabTemplate[] {
  if (!Array.isArray(value) || value.length > MAX_ORCA_YAML_COLLECTION_ENTRIES) {
    return []
  }

  return value
    .map((entry) => {
      const record = asRecord(entry)
      if (!record) {
        return null
      }
      const title = asTrimmedString(record.title)
      const command = asTrimmedString(record.command)
      const color = asTrimmedString(record.color)
      const normalizedColor = color && DEFAULT_TAB_COLOR_RE.test(color) ? color : undefined
      if (!title && !command && !normalizedColor) {
        return null
      }
      return {
        ...(title ? { title } : {}),
        ...(normalizedColor ? { color: normalizedColor } : {}),
        ...(command ? { command } : {})
      }
    })
    .filter((entry): entry is OrcaDefaultTabTemplate => entry !== null)
}

/**
 * Parse the supported project defaults from `orca.yaml`.
 */
export function parseOrcaYaml(content: string): OrcaHooks | null {
  if (!isOrcaYamlTextWithinLimit(content)) {
    return null
  }

  let root: unknown
  try {
    const document = parseDocument(content, {
      keepSourceTokens: false,
      logLevel: 'silent',
      prettyErrors: false,
      uniqueKeys: true
    })
    if (document.errors.length > 0) {
      return null
    }
    root = document.toJS({ maxAliasCount: MAX_ORCA_YAML_ALIAS_COUNT })
  } catch {
    return null
  }

  const record = asRecord(root)
  if (!record) {
    return null
  }

  const scriptsRecord = asRecord(record.scripts)
  const setup = scriptsRecord ? asTrimmedString(scriptsRecord.setup) : undefined
  const archive = scriptsRecord ? asTrimmedString(scriptsRecord.archive) : undefined
  const setupAgentStartupPolicy =
    record.setupAgentStartupPolicy === 'start-immediately' ||
    record.setupAgentStartupPolicy === 'wait-for-setup'
      ? record.setupAgentStartupPolicy
      : undefined
  const issueCommand = asTrimmedString(record.issueCommand)
  const defaultTabs = normalizeDefaultTabs(record.defaultTabs)
  const worktreeRecord = asRecord(record.worktree)
  const sharedDirectories = worktreeRecord
    ? normalizeSharedDirectories(worktreeRecord.sharedDirectories)
    : []

  if (
    !setup &&
    !archive &&
    !issueCommand &&
    !setupAgentStartupPolicy &&
    defaultTabs.length === 0 &&
    sharedDirectories.length === 0
  ) {
    return null
  }

  return {
    scripts: {
      ...(setup ? { setup } : {}),
      ...(archive ? { archive } : {})
    },
    ...(setupAgentStartupPolicy ? { setupAgentStartupPolicy } : {}),
    ...(issueCommand ? { issueCommand } : {}),
    ...(defaultTabs.length > 0 ? { defaultTabs } : {}),
    ...(sharedDirectories.length > 0 ? { worktree: { sharedDirectories } } : {})
  }
}
