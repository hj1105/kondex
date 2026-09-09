import { useEffect } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'

/**
 * A local rebuild replaced the app bundle under this process. Offer the restart
 * instead of forcing it: terminals and agents are mid-work, and session restore
 * makes the restart itself cheap once the user picks the moment.
 */
export function showPackagedBuildUpdatedToast(relaunch: () => Promise<void>): void {
  toast(translate('kondex.localBuild.title', 'A newer Kondex build is installed'), {
    description: translate(
      'kondex.localBuild.description',
      'This window still runs the previous build. Restart to use the new one; your tabs are restored.'
    ),
    duration: Infinity,
    dismissible: true,
    action: {
      label: translate('kondex.localBuild.restart', 'Restart now'),
      onClick: () => {
        void relaunch()
      }
    }
  })
}

export function PackagedBuildUpdateNoticeHost(): null {
  useEffect(() => {
    const subscribe = window.api?.ui?.onPackagedBuildUpdated
    if (!subscribe) {
      return
    }
    return subscribe(() => showPackagedBuildUpdatedToast(() => window.api.app.relaunch()))
  }, [])
  return null
}
