import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import type { KontextPlanEntry } from './kontext-plan-journal'
import { getKontextPlanningCopy } from './kontext-planning-copy'

export function KontextPlanRecovery({
  entry,
  busy,
  onRecover
}: {
  entry: KontextPlanEntry
  busy: boolean
  onRecover: () => void
}): React.JSX.Element | null {
  const copy = getKontextPlanningCopy()
  const [consent, setConsent] = useState(false)
  if (!entry.request && !entry.refinementRequest) {
    return null
  }
  return (
    <div className="space-y-3">
      {entry.request && (
        <p className="text-sm">
          {entry.request.goal} · {entry.request.provider}
        </p>
      )}
      <p className="break-all text-xs">{entry.workspace}</p>
      {entry.refinementRequest && (
        <p className="text-xs leading-5 text-muted-foreground">{copy.refinementScope}</p>
      )}
      <div className="flex items-start gap-2">
        <Checkbox
          id="kontext-plan-recovery-consent"
          checked={consent}
          disabled={busy}
          onCheckedChange={(value) => setConsent(value === true)}
        />
        <Label htmlFor="kontext-plan-recovery-consent" className="text-xs font-normal leading-5">
          {entry.refinementRequest ? copy.refinementConsent : copy.consent}
        </Label>
      </div>
      <Button
        variant="outline"
        disabled={busy || !consent}
        onClick={() => {
          setConsent(false)
          onRecover()
        }}
      >
        {copy.recover}
      </Button>
    </div>
  )
}
