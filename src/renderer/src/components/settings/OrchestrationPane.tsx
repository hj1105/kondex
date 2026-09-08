import { useActiveProjectSkillRuntime } from '@/hooks/useActiveProjectSkillRuntime'
import {
  GLOBAL_AGENT_SKILL_SOURCE_KINDS,
  useInstalledAgentSkill
} from '@/hooks/useInstalledAgentSkills'
import { translate } from '@/i18n/i18n'
import { ORCHESTRATION_SKILL_NAME } from '@/lib/agent-feature-install-commands'
import { ensureOrcaCliAvailableForAgentSkillTerminal } from '@/lib/agent-skill-cli-prerequisite'
import { isPairedWebClientWindow } from '@/lib/desktop-window-chrome'
import { getOrchestrationUsageExamples } from '@/lib/orchestration-usage-examples'
import type { SkillUsageExample } from '@/lib/skill-usage-example'
import { ArrowRightLeft, GitBranch, ListChecks, Workflow, type LucideIcon } from 'lucide-react'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import { resolveNestedWorkerMaxDepth } from '../../../../shared/nested-worker-depth'
import { useAppStore } from '../../store'
import { BundledAgentSkillSetupPanel } from './BundledAgentSkillSetupPanel'
import { ensureWslCliAvailableForAgentSkillTerminal } from './CliSkillRuntimeSetup'
import { OrchestrationSkillAgentCoverage } from './OrchestrationSkillAgentCoverage'
import { SearchableSetting } from './SearchableSetting'
import { NumberField } from './SettingsFormControls'
import { SkillUsageExamplesSection } from './SkillUsageExamplesSection'
import {
  getNestedWorkerDepthDescription,
  getNestedWorkerDepthTitle
} from './nested-worker-depth-copy'
import { getOrchestrationPaneSearchEntries } from './orchestration-search'
import { matchesSettingsSearch } from './settings-search'

const EXAMPLE_ICONS = {
  handoff: ArrowRightLeft,
  'worktree-handoff': ArrowRightLeft,
  'child-sequence': ListChecks,
  'child-parallel': GitBranch,
  'child-worktrees': Workflow
} as const

function resolveOrchestrationExampleIcon(example: SkillUsageExample): LucideIcon {
  return EXAMPLE_ICONS[example.id as keyof typeof EXAMPLE_ICONS] ?? Workflow
}

type OrchestrationPaneProps = {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void | Promise<void>
}

export function OrchestrationPane({
  settings,
  updateSettings
}: OrchestrationPaneProps): React.JSX.Element {
  const searchQuery = useAppStore((s) => s.settingsSearchQuery)
  const showNestedWorkerDepth = !isPairedWebClientWindow()
  const searchEntries = getOrchestrationPaneSearchEntries({
    includeNestedWorkerDepth: showNestedWorkerDepth
  })
  const showOrchestration = matchesSettingsSearch(searchQuery, searchEntries)
  const activeSkillRuntime = useActiveProjectSkillRuntime()

  const {
    installed: orchestrationSkillDetected,
    loading: orchestrationSkillLoading,
    error: orchestrationSkillError,
    skills: discoveredSkills,
    sources: discoveredSkillSources,
    refresh: refreshOrchestrationSkill
  } = useInstalledAgentSkill(ORCHESTRATION_SKILL_NAME, {
    discoveryTarget: activeSkillRuntime.discoveryTarget,
    sourceKinds: GLOBAL_AGENT_SKILL_SOURCE_KINDS
  })

  if (!showOrchestration) {
    return <div />
  }

  return (
    <SearchableSetting
      title={translate(
        'auto.components.settings.OrchestrationPane.191ac34567',
        'Agent Orchestration'
      )}
      description={translate(
        'auto.components.settings.OrchestrationPane.2aacdb0517',
        'Coordinate coding agents across handoffs, worktree handovers, and child-agent work.'
      )}
      keywords={searchEntries[0].keywords}
      forceVisible
      className="space-y-5 py-2"
    >
      <BundledAgentSkillSetupPanel
        title={translate(
          'auto.components.settings.OrchestrationPane.07641b9768',
          'Orchestration skill'
        )}
        description={translate(
          'auto.components.settings.OrchestrationPane.9bedd2a6e5',
          'Enables agents to hand off context and coordinate work through Kondex.'
        )}
        icon={<Workflow className="size-5" />}
        footer={
          <OrchestrationSkillAgentCoverage
            embedded
            skills={discoveredSkills}
            sources={discoveredSkillSources}
            loading={orchestrationSkillLoading}
          />
        }
        installDisabled={Boolean(activeSkillRuntime.installDisabledReason)}
        discoveryState={{
          installed: orchestrationSkillDetected,
          loading: orchestrationSkillLoading,
          error: activeSkillRuntime.installDisabledReason ?? orchestrationSkillError,
          refresh: refreshOrchestrationSkill
        }}
        skillName="kondex-orchestration"
        onBeforeInstall={async () => {
          await (activeSkillRuntime.agentRuntime?.runtime === 'wsl'
            ? ensureWslCliAvailableForAgentSkillTerminal(activeSkillRuntime.agentRuntime)
            : ensureOrcaCliAvailableForAgentSkillTerminal())
        }}
      />

      {showNestedWorkerDepth ? (
        <NumberField
          label={getNestedWorkerDepthTitle()}
          description={getNestedWorkerDepthDescription()}
          value={resolveNestedWorkerMaxDepth(settings)}
          min={1}
          integer
          onChange={(nestedWorkerMaxDepth) => {
            void updateSettings({ nestedWorkerMaxDepth })
          }}
        />
      ) : null}

      <SkillUsageExamplesSection
        heading={translate(
          'auto.components.settings.OrchestrationPane.ae79504732',
          'How to use it'
        )}
        description={translate(
          'auto.components.settings.OrchestrationPane.52e0634e2c',
          'Ask a coordinator agent to use orchestration for handoffs, worktree handovers, and sequential or parallel child agents.'
        )}
        examples={getOrchestrationUsageExamples()}
        resolveIcon={resolveOrchestrationExampleIcon}
        slashCommand={`/${ORCHESTRATION_SKILL_NAME}`}
      />
    </SearchableSetting>
  )
}
