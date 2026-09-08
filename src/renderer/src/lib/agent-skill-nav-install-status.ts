import type { SkillFreshnessInventory } from '../../../shared/skill-freshness'
import type { SettingsNavInstallStatus } from './settings-navigation-types'
import { getSkillFreshnessDisplayStatus } from './skill-freshness-display-status'

type AgentSkillNavInstallStatusInput = {
  name: string
  installed: boolean
  loading: boolean
  inventory: SkillFreshnessInventory | null
}

export function getAgentSkillNavInstallStatus({
  name,
  installed,
  loading,
  inventory
}: AgentSkillNavInstallStatusInput): SettingsNavInstallStatus {
  if (loading) {
    return 'checking'
  }
  if (!installed) {
    return 'install'
  }
  return getSkillFreshnessDisplayStatus(inventory, name)
}
