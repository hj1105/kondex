import { describe, expect, it } from 'vitest'
import type { DiscoveredSkill, SkillDiscoverySource } from '../../../shared/skills'
import type { TuiAgent } from '../../../shared/tui-agent'
import {
  agentHasOrchestrationSkill,
  getOrchestrationSkillAgentStatuses
} from './orchestration-skill-coverage'

function skill(overrides: Partial<DiscoveredSkill>): DiscoveredSkill {
  return {
    id: 'skill-1',
    name: 'kondex-orchestration',
    description: null,
    providers: ['agent-skills'],
    sourceKind: 'home',
    sourceLabel: 'Agent skills home',
    rootPath: '/Users/test/.agents/skills',
    directoryPath: '/Users/test/.agents/skills/kondex-orchestration',
    skillFilePath: '/Users/test/.agents/skills/kondex-orchestration/SKILL.md',
    installed: true,
    updatedAt: null,
    ...overrides
  }
}

function source(
  path: string,
  owner: SkillDiscoverySource['owner'],
  sourceKind: SkillDiscoverySource['sourceKind'] = 'home'
): SkillDiscoverySource {
  return {
    id: path,
    label: path,
    path,
    sourceKind,
    providers: ['agent-skills'],
    owner,
    exists: true
  }
}

describe('orchestration skill agent coverage', () => {
  it('does not count an existing Orca orchestration skill toward Kondex coverage', () => {
    expect(
      agentHasOrchestrationSkill(
        'claude',
        [
          skill({
            name: 'orchestration',
            directoryPath: '/Users/test/.agents/skills/orchestration'
          })
        ],
        [source('/Users/test/.agents/skills', null)]
      )
    ).toBe(false)
  })
  it('marks shared-path agents from the global ~/.agents/skills install', () => {
    const skills = [
      skill({
        providers: ['agent-skills'],
        sourceKind: 'home',
        rootPath: '/Users/test/.agents/skills',
        directoryPath: '/Users/test/.agents/skills/kondex-orchestration'
      })
    ]

    expect(
      getOrchestrationSkillAgentStatuses(
        skills,
        ['codex', 'claude'],
        [source('/Users/test/.agents/skills', null)]
      )
    ).toEqual([
      { agent: 'claude', label: 'Claude', installed: true },
      { agent: 'codex', label: 'Codex', installed: true }
    ])
  })

  it('marks Claude from ~/.claude/skills without requiring a dedicated Codex path', () => {
    const skills = [
      skill({
        providers: ['claude'],
        sourceKind: 'home',
        rootPath: '/Users/test/.claude/skills',
        directoryPath: '/Users/test/.claude/skills/kondex-orchestration'
      })
    ]

    const sources = [source('/Users/test/.claude/skills', 'claude')]
    expect(agentHasOrchestrationSkill('claude', skills, sources)).toBe(true)
    expect(agentHasOrchestrationSkill('codex', skills, sources)).toBe(false)
  })

  it('marks Codex from plugin cache installs', () => {
    expect(
      agentHasOrchestrationSkill(
        'codex',
        [
          skill({
            providers: ['codex', 'agent-skills'],
            sourceKind: 'plugin',
            sourceLabel: 'Codex plugin cache',
            rootPath: '/Users/test/.codex/plugins/cache',
            directoryPath: '/Users/test/.codex/plugins/cache/vendor/kondex-orchestration'
          })
        ],
        [source('/Users/test/.codex/plugins/cache', 'codex', 'plugin')]
      )
    ).toBe(true)
  })

  it('marks Claude from an enabled plugin install', () => {
    // Why: Claude Code loads skills from enabled plugins, so an owned plugin root
    // counts the same as the Codex plugin cache does.
    expect(
      agentHasOrchestrationSkill(
        'claude',
        [
          skill({
            providers: ['claude', 'agent-skills'],
            sourceKind: 'plugin',
            sourceLabel: 'Claude plugin',
            rootPath: '/Users/test/.claude/plugins/repos/vendor/pack/skills',
            directoryPath:
              '/Users/test/.claude/plugins/repos/vendor/pack/skills/kondex-orchestration'
          })
        ],
        [source('/Users/test/.claude/plugins/repos/vendor/pack/skills', 'claude', 'plugin')]
      )
    ).toBe(true)
  })

  it('ignores repo-scoped orchestration installs', () => {
    expect(
      agentHasOrchestrationSkill(
        'codex',
        [
          skill({
            providers: ['agent-skills'],
            sourceKind: 'repo',
            rootPath: '/workspace/.agents/skills',
            directoryPath: '/workspace/.agents/skills/kondex-orchestration'
          })
        ],
        [source('/workspace/.agents/skills', null, 'repo')]
      )
    ).toBe(false)
  })

  it('matches orchestration by directory name when frontmatter uses a display name', () => {
    expect(
      agentHasOrchestrationSkill(
        'claude',
        [
          skill({
            name: 'Kondex Orchestration',
            providers: ['claude'],
            sourceKind: 'home',
            rootPath: '/Users/test/.claude/skills',
            directoryPath: '/Users/test/.claude/skills/kondex-orchestration'
          })
        ],
        [source('/Users/test/.claude/skills', 'claude')]
      )
    ).toBe(true)
  })

  it('marks each provider-home agent from its own global skills location', () => {
    const cases: { agent: TuiAgent; rootPath: string; directoryPath: string }[] = [
      {
        agent: 'claude',
        rootPath: '/Users/test/.claude/skills',
        directoryPath: '/Users/test/.claude/skills/kondex-orchestration'
      },
      {
        agent: 'codex',
        rootPath: '/Users/test/.codex/skills',
        directoryPath: '/Users/test/.codex/skills/kondex-orchestration'
      }
    ]
    for (const { agent, rootPath, directoryPath } of cases) {
      const skills = [
        skill({ providers: ['agent-skills'], sourceKind: 'home', rootPath, directoryPath })
      ]
      const sources = [source(rootPath, agent)]
      expect(agentHasOrchestrationSkill(agent, skills, sources)).toBe(true)
      // Why: a provider-home install must not leak coverage to unrelated agents.
      expect(
        agentHasOrchestrationSkill(agent === 'claude' ? 'codex' : 'claude', skills, sources)
      ).toBe(false)
    }
  })

  it('marks every provider root retained after symlink deduplication', () => {
    const roots = [
      source('/Users/test/.codex/skills', 'codex'),
      source('/Users/test/.claude/skills', 'claude')
    ]
    const skills = [
      skill({
        providers: ['codex', 'claude', 'agent-skills'],
        rootPath: roots[0].path,
        rootPaths: roots.map((root) => root.path),
        directoryPath: '/Users/test/.codex/skills/kondex-orchestration'
      })
    ]

    expect(
      getOrchestrationSkillAgentStatuses(skills, ['codex', 'claude'], roots).every(
        (status) => status.installed
      )
    ).toBe(true)
  })

  it('does not treat a repository shared root as a global install after deduplication', () => {
    const codexRoot = source('/Users/test/.codex/skills', 'codex')
    const repoRoot = source('/workspace/.agents/skills', null, 'repo')
    const skills = [
      skill({
        providers: ['codex', 'agent-skills'],
        rootPath: codexRoot.path,
        rootPaths: [codexRoot.path, repoRoot.path],
        directoryPath: '/Users/test/.codex/skills/kondex-orchestration'
      })
    ]

    expect(agentHasOrchestrationSkill('codex', skills, [codexRoot, repoRoot])).toBe(true)
    expect(agentHasOrchestrationSkill('claude', skills, [codexRoot, repoRoot])).toBe(false)
  })

  it('keeps the owning home root when a repo root duplicates its path', () => {
    // Why: a workspace whose cwd is the home dir scans ~/.claude/skills as both a
    // home and a repo root, and the repo duplicate sorts last by label.
    const skills = [
      skill({
        providers: ['claude'],
        sourceKind: 'home',
        rootPath: '/Users/test/.claude/skills',
        directoryPath: '/Users/test/.claude/skills/kondex-orchestration'
      })
    ]

    expect(
      agentHasOrchestrationSkill('claude', skills, [
        source('/Users/test/.claude/skills', 'claude'),
        source('/Users/test/.claude/skills', 'claude', 'repo')
      ])
    ).toBe(true)
  })

  it('leaves an agent uncovered when no source claims the skill root', () => {
    const skills = [
      skill({
        providers: ['claude'],
        sourceKind: 'home',
        rootPath: '/Users/test/.claude/skills',
        directoryPath: '/Users/test/.claude/skills/kondex-orchestration'
      })
    ]

    expect(agentHasOrchestrationSkill('claude', skills, [])).toBe(false)
  })

  it('marks Windows skill paths', () => {
    expect(
      agentHasOrchestrationSkill(
        'codex',
        [
          skill({
            providers: ['codex'],
            sourceKind: 'home',
            rootPath: 'C:\\Users\\test\\.codex\\skills',
            directoryPath: 'C:\\Users\\test\\.codex\\skills\\kondex-orchestration'
          })
        ],
        [source('C:\\Users\\test\\.codex\\skills', 'codex')]
      )
    ).toBe(true)
  })
})
