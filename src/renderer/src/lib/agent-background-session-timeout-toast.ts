import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import type { TuiAgent } from '../../../shared/tui-agent'

export function showAutomationPromptNotSentToast(_agent: TuiAgent): void {
  toast.message(
    translate(
      'auto.lib.launch.agent.background.session.4ca0651d56',
      "Your automation prompt wasn't sent — open the workspace and paste it."
    )
  )
}
