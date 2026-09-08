import React from 'react'
import { AutomationDeleteDialog } from './AutomationDeleteDialogs'

type Props = {
  deleteTarget: React.ComponentProps<typeof AutomationDeleteDialog>['deleteTarget']
  dontAskDeleteAgain: boolean
  deleteConfirmButtonRef: React.ComponentProps<typeof AutomationDeleteDialog>['confirmButtonRef']
  setDeleteTarget: (target: null) => void
  setDontAskDeleteAgain: (value: boolean) => void
  confirmDeleteAutomation: () => void
}

export function AutomationsPageDeleteDialogs({
  deleteTarget,
  dontAskDeleteAgain,
  deleteConfirmButtonRef,
  setDeleteTarget,
  setDontAskDeleteAgain,
  confirmDeleteAutomation
}: Props): React.JSX.Element {
  return (
    <AutomationDeleteDialog
      deleteTarget={deleteTarget}
      dontAskDeleteAgain={dontAskDeleteAgain}
      confirmButtonRef={deleteConfirmButtonRef}
      onOpenChange={(open) => {
        if (!open) {
          setDeleteTarget(null)
          setDontAskDeleteAgain(false)
        }
      }}
      onDontAskAgainToggle={() => setDontAskDeleteAgain(!dontAskDeleteAgain)}
      onCancel={() => {
        setDeleteTarget(null)
        setDontAskDeleteAgain(false)
      }}
      onConfirm={confirmDeleteAutomation}
    />
  )
}
