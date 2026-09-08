import { useActiveProjectSkillRuntime } from '@/hooks/useActiveProjectSkillRuntime'
import type { InstalledAgentSkillState } from '@/hooks/useInstalledAgentSkills'
import { ensureOrcaCliAvailableForAgentSkillTerminal } from '@/lib/agent-skill-cli-prerequisite'
import type { JSX } from 'react'
import { BundledAgentSkillSetupPanel } from './BundledAgentSkillSetupPanel'
import { ensureWslCliAvailableForAgentSkillTerminal } from './CliSkillRuntimeSetup'

import { translate } from '@/i18n/i18n'

export function OrchestrationSetupCard(props: {
  compact?: boolean
  terminalHeightPx?: number
  skill: InstalledAgentSkillState
}): JSX.Element {
  const { compact, skill } = props
  const activeSkillRuntime = useActiveProjectSkillRuntime()

  const setupPanel = (
    <BundledAgentSkillSetupPanel
      title={translate(
        'auto.components.settings.OrchestrationSetupCard.2777ff0fdc',
        'Orchestration skill'
      )}
      description={translate(
        'auto.components.settings.OrchestrationSetupCard.e7d2a5146c',
        'Enables agents to hand off context and coordinate work through Kondex.'
      )}
      className={compact ? 'w-full max-w-[520px]' : undefined}
      installDisabled={Boolean(activeSkillRuntime.installDisabledReason)}
      discoveryState={{
        installed: skill.installed,
        loading: skill.loading,
        error: activeSkillRuntime.installDisabledReason ?? skill.error,
        refresh: skill.refresh
      }}
      skillName="kondex-orchestration"
      onBeforeInstall={async () => {
        await (activeSkillRuntime.agentRuntime?.runtime === 'wsl'
          ? ensureWslCliAvailableForAgentSkillTerminal(activeSkillRuntime.agentRuntime)
          : ensureOrcaCliAvailableForAgentSkillTerminal())
      }}
    />
  )

  if (compact) {
    return <div className="flex min-h-24 flex-1 items-center justify-center">{setupPanel}</div>
  }
  return <div className="flex">{setupPanel}</div>
}
