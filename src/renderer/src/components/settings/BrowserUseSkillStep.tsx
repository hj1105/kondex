import { BundledAgentSkillSetupPanel } from './BundledAgentSkillSetupPanel'
import { StepBadge } from './SetupStepBadge'
import { translate } from '@/i18n/i18n'

type Props = {
  skillDetected: boolean
  skillLoading: boolean
  skillError: string | null
  disabled?: boolean
  onBeforeOpenTerminal?: () => void | Promise<void>
  onRecheck: () => void | Promise<unknown>
}

export function BrowserUseSkillStep(props: Props): React.JSX.Element {
  return (
    <BundledAgentSkillSetupPanel
      variant="inline"
      title={translate(
        'auto.components.settings.BrowserUseSkillStep.459e24eebc',
        'Browser Use skill'
      )}
      description={translate(
        'auto.components.settings.BrowserUseSkillStep.0871b6998d',
        "Enables agents to navigate and verify pages in Kondex's browser."
      )}
      skillName="kondex-cli"
      discoveryState={{
        installed: props.skillDetected,
        loading: props.skillLoading,
        error: props.skillError,
        refresh: props.onRecheck
      }}
      installDisabled={props.disabled}
      leading={<StepBadge index={2} state={props.skillDetected ? 'done' : 'pending'} />}
      onBeforeInstall={props.onBeforeOpenTerminal}
    />
  )
}
