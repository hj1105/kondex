import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  resolveEnvironmentSkillProviderRoots,
  withClaudeSkillProviderRoot
} from './skill-provider-runtime-roots'

describe('skill provider runtime roots', () => {
  it('maps the Claude config home and ignores retired provider homes', () => {
    const root = resolve('/srv/claude')
    expect(
      resolveEnvironmentSkillProviderRoots({
        CLAUDE_CONFIG_DIR: root,
        GROK_HOME: resolve('/srv/grok'),
        HERMES_HOME: resolve('/srv/hermes')
      })
    ).toEqual({ claude: join(root, 'skills') })
  })

  it.each(['../claude', '', ' ', '/srv/claude\0other', `/${'a'.repeat(32768)}`])(
    'rejects unsafe config root %j',
    (root) => {
      expect(resolveEnvironmentSkillProviderRoots({ CLAUDE_CONFIG_DIR: root })).toEqual({})
    }
  )

  it('normalizes whitespace and lets a managed Claude root win', () => {
    const root = resolve('/srv/claude')
    const managed = resolve('/managed/claude')
    const roots = resolveEnvironmentSkillProviderRoots({ CLAUDE_CONFIG_DIR: `  ${root}  ` })
    expect(roots).toEqual({ claude: join(root, 'skills') })
    expect(withClaudeSkillProviderRoot(roots, managed)).toEqual({ claude: join(managed, 'skills') })
  })

  it('preserves existing roots when a managed override is missing or unsafe', () => {
    const roots = {
      codex: resolve('/managed/codex/skills'),
      claude: resolve('/managed/claude/skills')
    }
    for (const override of [null, undefined, '../relative', '/srv/claude\0other']) {
      expect(withClaudeSkillProviderRoot(roots, override)).toBe(roots)
    }
    expect(resolveEnvironmentSkillProviderRoots({})).toEqual({})
  })
})
