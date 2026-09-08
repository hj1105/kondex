import { MonitorCog } from 'lucide-react'
import { BundledAgentSkillSetupPanel } from './BundledAgentSkillSetupPanel'
import { translate } from '@/i18n/i18n'

export function ComputerUseSkillSetupPanel(): React.JSX.Element {
  return (
    <BundledAgentSkillSetupPanel
      title={translate('auto.components.settings.ComputerUsePane.93255aaf18', 'Computer Use skill')}
      description={translate(
        'auto.components.settings.ComputerUsePane.1735461723',
        'Enables agents to inspect and operate local desktop apps.'
      )}
      skillName="kondex-computer-use"
      icon={<MonitorCog className="size-5" />}
    />
  )
}
