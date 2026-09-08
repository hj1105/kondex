import { useCallback, useEffect, useRef, useState } from 'react'
import { FileText } from 'lucide-react'
import { toast } from 'sonner'
import type {
  DiagnosticsBundlePayload,
  DiagnosticsStatusPayload
} from '../../../../preload/api-types'
import { translate } from '@/i18n/i18n'
import { Label } from '../ui/label'
import { Separator } from '../ui/separator'
import {
  getDiagnosticBundleDescription,
  PrivacyDiagnosticBundleControls
} from './PrivacyDiagnosticBundleControls'

export function PrivacyDiagnosticsSection(): React.JSX.Element {
  const [status, setStatus] = useState<DiagnosticsStatusPayload | null>(null)
  const [bundle, setBundle] = useState<DiagnosticsBundlePayload | null>(null)
  const [previewOpened, setPreviewOpened] = useState(false)
  const [collecting, setCollecting] = useState(false)
  const [openingPreview, setOpeningPreview] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  const mountedRef = useRef(true)
  const activeBundleSubmissionIdRef = useRef<string | null>(null)

  const refreshStatus = useCallback(async (): Promise<void> => {
    try {
      const next = await window.api.diagnostics.getStatus()
      if (mountedRef.current) {
        setStatus(next)
      }
    } catch {
      // The pane remains unavailable while desktop IPC is not ready.
    }
  }, [])

  useEffect(() => {
    void refreshStatus()
  }, [refreshStatus])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (activeBundleSubmissionIdRef.current) {
        void window.api.diagnostics.discardBundlePreview(activeBundleSubmissionIdRef.current)
      }
    }
  }, [])

  const handleCollectBundle = useCallback(async (): Promise<void> => {
    setCollecting(true)
    try {
      const nextBundle = await window.api.diagnostics.collectBundle()
      if (!mountedRef.current) {
        await window.api.diagnostics.discardBundlePreview(nextBundle.bundleId)
        return
      }
      activeBundleSubmissionIdRef.current = nextBundle.bundleId
      setBundle(nextBundle)
      setPreviewOpened(false)
      toast.success(
        translate(
          'auto.components.settings.PrivacyDiagnosticsSection.a2b3505c77',
          'Review file created'
        )
      )
    } catch (error) {
      if (mountedRef.current) {
        toast.error(getDiagnosticsErrorMessage(error, 'Could not create review file'))
      }
    } finally {
      if (mountedRef.current) {
        setCollecting(false)
      }
    }
  }, [])

  const handleOpenPreview = useCallback(async (): Promise<void> => {
    if (!bundle) {
      return
    }
    setOpeningPreview(true)
    try {
      await window.api.diagnostics.openBundlePreview(bundle.bundleId)
      if (mountedRef.current) {
        setPreviewOpened(true)
        toast.success(
          translate(
            'auto.components.settings.PrivacyDiagnosticsSection.db3228e01a',
            'Review file opened'
          )
        )
      }
    } catch (error) {
      if (mountedRef.current) {
        toast.error(getDiagnosticsErrorMessage(error, 'Could not open review file'))
      }
    } finally {
      if (mountedRef.current) {
        setOpeningPreview(false)
      }
    }
  }, [bundle])

  const handleDiscardBundle = useCallback(async (): Promise<void> => {
    if (!bundle) {
      return
    }
    setDiscarding(true)
    try {
      await window.api.diagnostics.discardBundlePreview(bundle.bundleId)
      if (mountedRef.current) {
        activeBundleSubmissionIdRef.current = null
        setBundle(null)
        setPreviewOpened(false)
        toast.success(
          translate(
            'auto.components.settings.PrivacyDiagnosticsSection.860bca9ec9',
            'Review file discarded'
          )
        )
      }
    } catch (error) {
      if (mountedRef.current) {
        toast.error(getDiagnosticsErrorMessage(error, 'Could not discard review file'))
      }
    } finally {
      if (mountedRef.current) {
        setDiscarding(false)
      }
    }
  }, [bundle])

  return (
    <>
      {status?.disabledReason ? (
        <DiagnosticsDisabledStateNote reason={status.disabledReason} />
      ) : null}
      <Separator />
      <PrivacyDiagnosticsRow
        icon={<FileText className="size-4" />}
        title={translate(
          'auto.components.settings.PrivacyDiagnosticsSection.19c9476fa1',
          'Local diagnostic file'
        )}
        description={getDiagnosticBundleDescription({ bundle, previewOpened })}
      >
        <PrivacyDiagnosticBundleControls
          status={status}
          bundle={bundle}
          collecting={collecting}
          openingPreview={openingPreview}
          discarding={discarding}
          onCollect={handleCollectBundle}
          onOpenPreview={handleOpenPreview}
          onDiscard={handleDiscardBundle}
        />
      </PrivacyDiagnosticsRow>
    </>
  )
}

function getDiagnosticsErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function DiagnosticsDisabledStateNote({
  reason
}: {
  reason: NonNullable<DiagnosticsStatusPayload['disabledReason']>
}): React.JSX.Element {
  const message =
    reason === 'diagnostics_disabled'
      ? translate(
          'auto.components.settings.PrivacyDiagnosticsRows.d37e92a06b',
          'KONDEX_DIAGNOSTICS_DISABLED=1 is set — local app diagnostics are off.'
        )
      : translate(
          'auto.components.settings.PrivacyDiagnosticsRows.5ebb31e1fb',
          'Running in CI — local diagnostics are off.'
        )

  return (
    <div className="rounded border border-dashed border-border/60 bg-card/30 px-3 py-2 text-xs text-muted-foreground">
      {message}
    </div>
  )
}

function PrivacyDiagnosticsRow({
  icon,
  title,
  description,
  children
}: {
  icon: React.ReactNode
  title: string
  description: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <div className="mt-0.5 text-muted-foreground">{icon}</div>
        <div className="min-w-0 space-y-0.5">
          <Label className="text-sm">{title}</Label>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{children}</div>
    </div>
  )
}
