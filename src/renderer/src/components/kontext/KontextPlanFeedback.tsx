import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { getKontextPlanningCopy } from './kontext-planning-copy'

export function KontextPlanFeedback({
  disabled,
  onRefine
}: {
  disabled: boolean
  onRefine: (feedback: string) => void
}): React.JSX.Element {
  const copy = getKontextPlanningCopy()
  const [feedback, setFeedback] = useState('')
  const [consent, setConsent] = useState(false)
  return (
    <details className="space-y-3">
      <summary className="cursor-pointer text-sm">{copy.refine}</summary>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          if (!disabled && consent && feedback.trim()) {
            setConsent(false)
            onRefine(feedback)
          }
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="kontext-plan-feedback">{copy.feedback}</Label>
          <p className="text-xs leading-5 text-muted-foreground">{copy.refinementScope}</p>
          <Textarea
            id="kontext-plan-feedback"
            maxLength={8192}
            value={feedback}
            disabled={disabled}
            onChange={(event) => {
              setFeedback(event.target.value)
              setConsent(false)
            }}
          />
        </div>
        <div className="flex items-start gap-2">
          <Checkbox
            id="kontext-plan-refinement-consent"
            checked={consent}
            disabled={disabled}
            onCheckedChange={(value) => setConsent(value === true)}
          />
          <Label
            htmlFor="kontext-plan-refinement-consent"
            className="text-xs font-normal leading-5"
          >
            {copy.refinementConsent}
          </Label>
        </div>
        <Button type="submit" variant="outline" disabled={disabled || !consent || !feedback.trim()}>
          {copy.refine}
        </Button>
      </form>
    </details>
  )
}
