import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import { getRuntimeEnvironmentRevision } from '@/runtime/runtime-environment-revision'
import {
  kontextSourceInspectionSchema,
  type KontextSourceInspection
} from '../../../../shared/kontext-source-contract'
import type { KontextRequestOwner } from './kontext-request-journal'
import { getKontextSourceSharingCopy } from './kontext-source-copy'

export function KontextSourceSharing({
  owner,
  initialResourceId = ''
}: {
  owner: KontextRequestOwner
  initialResourceId?: string
}): React.JSX.Element {
  useTranslation()
  const copy = getKontextSourceSharingCopy()
  const [resourceId, setResourceId] = useState(initialResourceId)
  const [source, setSource] = useState<KontextSourceInspection | null>(null)
  const [providers, setProviders] = useState<string[]>([])
  const [classification, setClassification] = useState('internal')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [showProgress, setShowProgress] = useState(false)
  const [failed, setFailed] = useState(false)
  const inFlight = useRef(false)
  useEffect(() => {
    if (!busy) {
      setShowProgress(false)
      return
    }
    const timer = window.setTimeout(() => setShowProgress(true), 250)
    return () => window.clearTimeout(timer)
  }, [busy])
  const ownerCurrent = () =>
    owner.kind === 'local' ||
    getRuntimeEnvironmentRevision(owner.environmentId) === owner.pairingRevision

  async function perform(action: 'inspectSource' | 'refreshSource' | 'setSourceSharing') {
    if (inFlight.current || !resourceId.trim()) {
      return
    }
    if (action === 'setSourceSharing' && (!source || !consent)) {
      return
    }
    const expected = source
    const request =
      action === 'setSourceSharing' && expected
        ? {
            resourceId,
            expectedRevision: expected.revision,
            expectedContentHash: expected.contentHash,
            dataClassification: classification,
            allowedRuntimeProviders: providers
          }
        : { resourceId }
    setFailed(false)
    setConsent(false)
    setSource(null)
    if (!ownerCurrent()) {
      setFailed(true)
      return
    }
    inFlight.current = true
    setBusy(true)
    try {
      const response = await callRuntimeRpc<unknown>(owner, `kontext.${action}`, request, {
        expectedEnvironmentPairingRevision:
          owner.kind === 'environment' ? owner.pairingRevision : undefined,
        timeoutMs: 60_000
      })
      if (!ownerCurrent()) {
        throw new Error('Owner changed')
      }
      const inspected = kontextSourceInspectionSchema.parse(response)
      if (inspected.resourceId !== resourceId) {
        throw new Error('Source identity mismatch')
      }
      if (
        action === 'setSourceSharing' &&
        (!expected ||
          inspected.revision !== expected.revision + 1 ||
          inspected.contentHash !== expected.contentHash ||
          inspected.sharing?.dataClassification !== classification ||
          JSON.stringify([...inspected.sharing.allowedRuntimeProviders].sort()) !==
            JSON.stringify([...providers].sort()))
      ) {
        throw new Error('Sharing outcome unknown')
      }
      setSource(inspected)
      setProviders(inspected.sharing?.allowedRuntimeProviders ?? [])
      setClassification(inspected.sharing?.dataClassification ?? 'internal')
    } catch {
      setFailed(true)
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }
  return (
    <section
      className="space-y-3 border-t border-border pt-4"
      aria-labelledby="kontext-sharing-heading"
    >
      <h3 id="kontext-sharing-heading" className="text-sm font-medium">
        {copy.title}
      </h3>
      <p className="text-xs leading-5 text-muted-foreground">{copy.intro}</p>
      <div className="space-y-2">
        <Label htmlFor="kontext-sharing-resource">{copy.resource}</Label>
        <Input
          id="kontext-sharing-resource"
          value={resourceId}
          disabled={busy}
          onChange={(event) => {
            setResourceId(event.target.value)
            setSource(null)
            setConsent(false)
            setFailed(false)
          }}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={busy || !resourceId.trim()}
          onClick={() => void perform('inspectSource')}
        >
          {copy.inspect}
        </Button>
        <Button
          variant="outline"
          disabled={busy || !resourceId.trim()}
          onClick={() => void perform('refreshSource')}
        >
          {copy.refresh}
        </Button>
      </div>
      <p role="status" className="min-h-5 text-xs text-muted-foreground">
        {showProgress ? copy.busy : ''}
      </p>
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {copy.failed}
        </p>
      )}
      {source && (
        <div className="space-y-3">
          <p className="break-all font-mono text-xs">
            {source.title} · {source.contentHash}
          </p>
          <p className="text-xs text-muted-foreground">
            {source.status === 'active' ? copy.active : copy.stale}
          </p>
          <p className="text-xs">
            {copy.saved}: {source.sharing?.allowedRuntimeProviders.join(', ') || copy.none}
          </p>
          <div className="space-y-2">
            <Label htmlFor="kontext-sharing-classification">{copy.classification}</Label>
            <Select
              value={classification}
              onValueChange={(value) => {
                setClassification(value)
                setConsent(false)
              }}
            >
              <SelectTrigger id="kontext-sharing-classification">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['public', 'internal', 'confidential', 'restricted'] as const).map((value) => (
                  <SelectItem key={value} value={value}>
                    {copy[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-4">
            {(['codex', 'claude'] as const).map((provider) => (
              <div key={provider} className="flex items-center gap-2">
                <Checkbox
                  id={`kontext-sharing-${provider}`}
                  checked={providers.includes(provider)}
                  onCheckedChange={(checked) => {
                    setProviders((current) =>
                      checked === true
                        ? [...current.filter((item) => item !== provider), provider]
                        : current.filter((item) => item !== provider)
                    )
                    setConsent(false)
                  }}
                />
                <Label htmlFor={`kontext-sharing-${provider}`}>
                  {provider === 'codex' ? 'Codex' : 'Claude'}
                </Label>
              </div>
            ))}
          </div>
          <div className="flex items-start gap-2">
            <Checkbox
              id="kontext-sharing-consent"
              checked={consent}
              onCheckedChange={(checked) => setConsent(checked === true)}
            />
            <Label htmlFor="kontext-sharing-consent" className="text-xs leading-5">
              {copy.consent}
            </Label>
          </div>
          <Button
            disabled={!consent || (source.status !== 'active' && providers.length > 0)}
            onClick={() => void perform('setSourceSharing')}
          >
            {copy.save}
          </Button>
        </div>
      )}
    </section>
  )
}
