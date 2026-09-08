import type { SkillSourceKind } from '../../../../shared/skills'
import { translate } from '@/i18n/i18n'

// Why: 'repo' roots also come from folder workspaces, so "Repository" misnames
// half of them; "Workspace" matches the rest of the product's terminology.
export function sourceKindLabel(kind: SkillSourceKind): string {
  switch (kind) {
    case 'home':
      return translate('auto.components.skills.sourceKind.home', 'Home')
    case 'repo':
      return translate('auto.components.skills.sourceKind.workspace', 'Workspace')
    case 'bundled':
      return translate('auto.components.skills.sourceKind.bundled', 'Bundled')
    case 'plugin':
      return translate('auto.components.skills.sourceKind.plugin', 'Plugin')
  }
}

export function skillCountLabel(count: number): string {
  return count === 1
    ? translate('auto.components.skills.count.skillOne', '{{count}} skill', { count })
    : translate('auto.components.skills.count.skillOther', '{{count}} skills', { count })
}

export function sourceCountLabel(count: number): string {
  return count === 1
    ? translate('auto.components.skills.count.sourceOne', '{{count}} source', { count })
    : translate('auto.components.skills.count.sourceOther', '{{count}} sources', { count })
}

export function resultCountLabel(count: number): string {
  return count === 1
    ? translate('auto.components.skills.count.resultOne', '{{count}} result', { count })
    : translate('auto.components.skills.count.resultOther', '{{count}} results', { count })
}

export function selectedCountLabel(count: number): string {
  return translate('auto.components.skills.count.selected', '{{count}} selected', { count })
}
