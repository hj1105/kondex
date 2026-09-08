import { Eye, FileText, Loader2, X } from 'lucide-react'
import type {
  DiagnosticsBundlePayload,
  DiagnosticsStatusPayload
} from '../../../../preload/api-types'
import { translate } from '@/i18n/i18n'
import { Button } from '../ui/button'

export function PrivacyDiagnosticBundleControls({
  status,
  bundle,
  collecting,
  openingPreview,
  discarding,
  onCollect,
  onOpenPreview,
  onDiscard
}: {
  readonly status: DiagnosticsStatusPayload | null
  readonly bundle: DiagnosticsBundlePayload | null
  readonly collecting: boolean
  readonly openingPreview: boolean
  readonly discarding: boolean
  readonly onCollect: () => Promise<void>
  readonly onOpenPreview: () => Promise<void>
  readonly onDiscard: () => Promise<void>
}): React.JSX.Element {
  if (bundle) {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          disabled={openingPreview}
          onClick={() => void onOpenPreview()}
        >
          <ActionIcon busy={openingPreview} icon={<Eye className="size-3.5" />} />
          {translate(
            'auto.components.settings.PrivacyDiagnosticBundleControls.798b6f0be5',
            'Open review file'
          )}
        </Button>
        <Button variant="ghost" size="sm" disabled={discarding} onClick={() => void onDiscard()}>
          <ActionIcon busy={discarding} icon={<X className="size-3.5" />} />
          {translate(
            'auto.components.settings.PrivacyDiagnosticBundleControls.a5acaffdb6',
            'Discard'
          )}
        </Button>
      </>
    )
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={!status?.bundleEnabled || collecting}
      onClick={() => void onCollect()}
    >
      <ActionIcon busy={collecting} icon={<FileText className="size-3.5" />} />
      {translate(
        'auto.components.settings.PrivacyDiagnosticBundleControls.dc8404a930',
        'Create diagnostic file'
      )}
    </Button>
  )
}

export function getDiagnosticBundleDescription({
  bundle,
  previewOpened
}: {
  readonly bundle: DiagnosticsBundlePayload | null
  readonly previewOpened: boolean
}): string {
  if (bundle) {
    const size = formatBytes(bundle.bytes)
    return previewOpened
      ? translate(
          'auto.components.settings.PrivacyDiagnosticBundleControls.b594d97e68',
          'Opened locally ({{value0}}). Kondex does not upload it; share it manually only if you choose.',
          { value0: size }
        )
      : translate(
          'auto.components.settings.PrivacyDiagnosticBundleControls.9de5da184d',
          'A redacted local review file is ready ({{value0}}). Open it to inspect the contents.',
          { value0: size }
        )
  }
  return translate(
    'auto.components.settings.PrivacyDiagnosticBundleControls.10dcdbdb19',
    'Creates a redacted local review file. Kondex never uploads it.'
  )
}

function ActionIcon({ busy, icon }: { readonly busy: boolean; readonly icon: React.ReactNode }) {
  return busy ? <Loader2 className="size-3.5 animate-spin" /> : icon
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
