import { homedir } from 'node:os'
import type { CommandHandler } from '../dispatch'
import { RuntimeClientError, getDefaultUserDataPath } from '../runtime-client'
import { getRepeatedStringFlag } from '../flags'
import { detectCommandsInInstallDirs } from '../../shared/local-agent-install-dir-detection'
import {
  getTuiAgentDetectionProbeCommands,
  KNOWN_TUI_AGENT_DETECTION_COMMANDS,
  resolveDetectedTuiAgentIds
} from '../../shared/tui-agent-detection-commands'
import { isSkillsCliAgentKeyShaped, toSkillsCliAgentKeys } from '../../shared/skills-cli-agent-keys'
import { resolveEnvironmentSkillProviderRoots } from '../../main/skills/skill-provider-runtime-roots'

type BundledSkillGuide = {
  name: string
  description: string
  markdown: string
  fullMarkdown: string
  aliases: readonly string[]
}

function canonicalGuides(guides: readonly BundledSkillGuide[]): BundledSkillGuide[] {
  return [...guides].sort((left, right) =>
    left.name < right.name ? -1 : left.name > right.name ? 1 : 0
  )
}

function requireTopic(
  flags: Map<string, string | boolean>,
  guides: BundledSkillGuide[]
): BundledSkillGuide {
  const availableTopics = guides.map((guide) => guide.name).join(', ')
  const topic = flags.get('topic')
  if (typeof topic !== 'string' || topic.length === 0) {
    throw new RuntimeClientError(
      'invalid_argument',
      `Missing skill topic. Available topics: ${availableTopics}`
    )
  }
  // Why: installed stubs may retain an old topic forever, so aliases and canonical
  // names share one lookup table instead of being treated as transient CLI aliases.
  const guideByTopic = new Map<string, BundledSkillGuide>(
    guides.flatMap((guide) => [guide.name, ...guide.aliases].map((name) => [name, guide]))
  )
  const guide = guideByTopic.get(topic)
  if (!guide) {
    throw new RuntimeClientError(
      'invalid_argument',
      `Unknown skill topic "${topic}". Available topics: ${availableTopics}`
    )
  }
  return guide
}

function writeStdout(value: string): void {
  process.stdout.write(value.endsWith('\n') ? value : `${value}\n`)
}

function resolveSelectedSkillNames(
  flags: Map<string, string | boolean>,
  guides: BundledSkillGuide[]
): string[] {
  const requestedSkills = getRepeatedStringFlag(flags, 'skill')
  const selectAll = flags.get('all') === true
  if (flags.has('skill') && requestedSkills.length === 0) {
    throw new RuntimeClientError('invalid_argument', 'Missing required --skill')
  }
  if (selectAll && requestedSkills.length > 0) {
    throw new RuntimeClientError('invalid_argument', 'Use either --all or --skill, not both.')
  }
  if (!selectAll && requestedSkills.length === 0) {
    return []
  }
  if (selectAll) {
    return guides.map((guide) => guide.name)
  }
  const availableTopics = guides.map((guide) => guide.name).join(', ')
  const guideByTopic = new Map<string, BundledSkillGuide>(
    guides.flatMap((guide) => [guide.name, ...guide.aliases].map((name) => [name, guide]))
  )
  const canonicalNames = new Set<string>()
  for (const requested of requestedSkills) {
    const guide = guideByTopic.get(requested)
    if (!guide) {
      throw new RuntimeClientError(
        'invalid_argument',
        `Unknown skill "${requested}". Available skills: ${availableTopics}`
      )
    }
    canonicalNames.add(guide.name)
  }
  return [...canonicalNames].sort()
}

type SkillMutationVerb = 'install' | 'update'

/** Agents Kondex can see on this host, as `skills --agent` keys. */
function detectSkillsCliAgentKeys(): string[] {
  const runtime = process.platform
  const probes = getTuiAgentDetectionProbeCommands(KNOWN_TUI_AGENT_DETECTION_COMMANDS, runtime)
  const detected = resolveDetectedTuiAgentIds(
    KNOWN_TUI_AGENT_DETECTION_COMMANDS,
    detectCommandsInInstallDirs(probes),
    runtime
  )
  return detected.length === 0 ? [] : toSkillsCliAgentKeys(detected)
}

function resolveInstallAgentKeys(flags: Map<string, string | boolean>): string[] {
  const requested = flags.get('agent')
  if (flags.has('agent') && typeof requested !== 'string') {
    throw new RuntimeClientError('invalid_argument', 'Missing required --agent')
  }
  if (typeof requested === 'string') {
    // Why: one comma-separated value rather than a repeatable flag — `agent` is a
    // single-value flag on other commands and the repeatable set is process-wide,
    // so making it repeatable here would change how those parse a second --agent.
    const keys = [
      ...new Set(
        requested
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean)
      )
    ]
    // An empty explicit selection must not silently fall through to host detection.
    if (keys.length === 0) {
      throw new RuntimeClientError('invalid_argument', 'Missing required --agent')
    }
    const unusable = keys.find(
      (key) =>
        !isSkillsCliAgentKeyShaped(key) ||
        !['claude-code', 'claude', 'codex', 'universal'].includes(key)
    )
    if (unusable !== undefined) {
      throw new RuntimeClientError(
        'invalid_argument',
        `Invalid --agent value "${unusable}". Pass agent names such as claude-code, ` +
          'codex, or universal.'
      )
    }
    return keys
  }
  const detected = detectSkillsCliAgentKeys()
  if (detected.length > 0) {
    return detected
  }
  // A headless host without a detected agent requires an explicit destination.
  throw new RuntimeClientError(
    'invalid_environment',
    'No coding agent detected on this host, so there is no install target. Pass ' +
      '--agent <name>[,<name>...] to choose targets explicitly — --agent universal ' +
      'writes only the shared .agents/skills directory that Kondex reads.'
  )
}

function formatSkillSelectionHelp(verb: SkillMutationVerb, skillNames: string[]): string {
  return [
    `Choose one or more skills to ${verb}:`,
    ...skillNames.map((name) => `  ${name}`),
    '',
    `Usage: kondex skills ${verb} --skill <name> [--skill <name> ...]`,
    `   or: kondex skills ${verb} --all`
  ].join('\n')
}

function createSkillMutationHandler(verb: SkillMutationVerb): CommandHandler {
  return async ({ flags, json, cwd }) => {
    // Why: keep the large generated table off the eager handler registry path.
    const { BUNDLED_SKILL_GUIDES } = await import('../bundled-skill-guides.js')
    const guides = canonicalGuides(BUNDLED_SKILL_GUIDES)
    const skillNames = resolveSelectedSkillNames(flags, guides)

    if (skillNames.length === 0) {
      const names = guides.map((guide) => guide.name)
      writeStdout(
        json
          ? JSON.stringify({ availableSkills: names }, null, 2)
          : formatSkillSelectionHelp(verb, names)
      )
      return
    }

    // Why: this runs before target resolution because the answer belongs to the
    // other machine — agents detected here would be the wrong host's, and a host
    // that detects none would hide the forwarding problem behind that error.
    if (process.env.ORCA_CLI_CWD) {
      throw new RuntimeClientError(
        'invalid_environment',
        `kondex skills ${verb} writes to the machine that runs it, but this shell forwards ` +
          `kondex to the Kondex host. Run the same kondex skills ${verb} command on the machine ` +
          "you want it on, where it can detect that host's agents."
      )
    }

    const global = flags.get('local') !== true
    // Why: install scopes its targets; update only refreshes what is already placed.
    const agents = verb === 'install' ? resolveInstallAgentKeys(flags) : []
    const command = [
      'kondex',
      'skills',
      verb,
      ...skillNames.flatMap((name) => ['--skill', name]),
      ...(global ? [] : ['--local']),
      ...(agents.length ? ['--agent', agents.join(',')] : [])
    ].join(' ')
    const dryRun = flags.get('dry-run') === true

    if (dryRun) {
      writeStdout(
        json
          ? JSON.stringify({ command, skills: skillNames, global, executed: false }, null, 2)
          : `${command}\n\nRerun without --dry-run to ${verb} now.`
      )
      return
    }

    const { mutateBundledAgentSkills } =
      await import('../../main/skills/bundled-agent-skill-install.js')
    const providers = [
      ...new Set(
        agents
          .filter((agent) => agent !== 'universal')
          .map((agent) => (agent === 'claude-code' ? 'claude' : agent))
      )
    ]
    process.stderr.write(`Using bundled Kondex skills: ${skillNames.join(', ')}\n`)
    const result = await mutateBundledAgentSkills({
      verb,
      skillNames,
      scope: global ? 'global' : 'workspace',
      homeDirectory: homedir(),
      workspaceDirectory: cwd,
      stateDirectory: getDefaultUserDataPath(),
      providers,
      providerRootOverrides: resolveEnvironmentSkillProviderRoots()
    })
    writeStdout(
      json
        ? JSON.stringify(result, null, 2)
        : [
            ...result.skills.map((skill) => `${skill.name}: ${skill.status}`),
            ...result.skippedSkills.map(
              (name) => `${name}: skipped (no existing Kondex-managed installation)`
            )
          ].join('\n')
    )
    process.exitCode = result.status === 'complete' ? 0 : 1
  }
}

export const SKILL_HANDLERS: Record<string, CommandHandler> = {
  'skills list': async ({ json }) => {
    // Why: the embedded guide table is large, so unrelated CLI commands must not
    // pay its module-load and parse cost during startup.
    const { BUNDLED_SKILL_GUIDES } = await import('../bundled-skill-guides.js')
    const guides = canonicalGuides(BUNDLED_SKILL_GUIDES)
    // Why: generated registry order is not a user-facing contract, while stable
    // canonical sorting keeps agent-visible output reproducible across builds.
    const topics = guides.map((guide) => ({
      name: guide.name,
      description: guide.description.replace(/\s+/g, ' ').trim()
    }))
    writeStdout(
      json
        ? JSON.stringify({ topics }, null, 2)
        : topics.map((topic) => `${topic.name}: ${topic.description}`).join('\n')
    )
  },
  'skills get': async ({ flags, json }) => {
    // Why: keep the large generated table off the eager handler registry path.
    const { BUNDLED_SKILL_GUIDES } = await import('../bundled-skill-guides.js')
    const guides = canonicalGuides(BUNDLED_SKILL_GUIDES)
    const guide = requireTopic(flags, guides)
    const full = flags.has('full')
    const markdown = full ? guide.fullMarkdown : guide.markdown
    writeStdout(json ? JSON.stringify({ name: guide.name, full, markdown }, null, 2) : markdown)
  },
  'skills install': createSkillMutationHandler('install'),
  'skills update': createSkillMutationHandler('update')
}
