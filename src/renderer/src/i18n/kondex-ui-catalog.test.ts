import { describe, expect, it } from 'vitest'
import en from './locales/en.json'
import es from './locales/es.json'
import fr from './locales/fr.json'
import ja from './locales/ja.json'
import ko from './locales/ko.json'
import zh from './locales/zh.json'

function leaves(value: unknown, prefix = ''): Record<string, string> {
  if (typeof value === 'string') {
    return { [prefix]: value }
  }
  if (!value || typeof value !== 'object') {
    return {}
  }
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) =>
      Object.entries(leaves(entry, prefix ? `${prefix}.${key}` : key))
    )
  )
}

const english = leaves(en.kondex)
const preservedNames = new Set(['Kondex', 'Codex', 'Claude', 'Context Receipt', 'Change Bundle'])

describe('Kondex UI catalog', () => {
  it.each([
    ['en', en, 'installation record', 'must not replace'],
    ['es', es, 'registro de instalación', 'no deben sustituirla'],
    ['fr', fr, 'registre d’installation', 'ne doivent pas la remplacer'],
    ['ja', ja, 'インストール記録', '置き換えてはいけません'],
    ['ko', ko, '설치 기록', '교체해서는 안 됩니다'],
    ['zh', zh, '安装记录', '不得将其替换']
  ] as const)(
    '%s explains independent-copy ownership and downgrade protection',
    (_locale, catalog, receipt, noDowngrade) => {
      const copy = catalog.auto.components.skills.SkillFreshnessRow
      expect(copy.skippedReasonDuplicate).toContain(receipt)
      expect(copy.skippedReasonNewer).toContain(noDowngrade)
    }
  )

  it('pins the full new-surface key inventory', () => {
    expect(Object.keys(english)).toHaveLength(359)
    expect(Object.keys(en.kondex.planning)).toEqual(
      expect.arrayContaining([
        'refine',
        'feedback',
        'parentPlan',
        'refinementScope',
        'refinementConsent'
      ])
    )
    expect(Object.keys(en.kondex.registeredIntegration)).toHaveLength(9)
    expect(Object.keys(en.kondex.scheduleHistory)).toHaveLength(8)
    expect(Object.keys(en.kondex.registeredSchedule)).toHaveLength(14)
    expect(Object.keys(en.kondex.taskInventory)).toHaveLength(13)
    expect(Object.keys(en.kondex.sessionSource)).toHaveLength(20)
    expect(Object.keys(en.kondex.ontology)).toHaveLength(69)
  })

  it.each(Object.entries({ es, fr, ja, ko, zh }))(
    '%s covers every new key and placeholder',
    (_locale, catalog) => {
      const translated = leaves(catalog.kondex)
      expect(Object.keys(translated).sort()).toEqual(Object.keys(english).sort())
      for (const [key, value] of Object.entries(translated)) {
        expect(value.trim(), key).not.toBe('')
        expect(value.match(/\{\{[^}]+\}\}/g)?.sort() ?? [], key).toEqual(
          english[key].match(/\{\{[^}]+\}\}/g)?.sort() ?? []
        )
        if (preservedNames.has(english[key])) {
          expect(value, key).toBe(english[key])
        } else {
          expect(value, key).not.toBe(english[key])
        }
      }
    }
  )

  it.each(Object.entries({ en, es, fr, ja, ko, zh }))(
    '%s omits retired setup surfaces',
    (_locale, catalog) => {
      const keys = Object.keys(leaves(catalog))
      for (const prefix of [
        'auto.components.settings.AgentSkillSetupPanel.',
        'auto.components.settings.EphemeralVmsPane.',
        'auto.components.sidebar.LinearAgentSkillSetupPrompt.',
        'auto.components.feature.wall.'
      ]) {
        expect(
          keys.filter((key) => key.startsWith(prefix)),
          prefix
        ).toEqual([])
      }
    }
  )
})
