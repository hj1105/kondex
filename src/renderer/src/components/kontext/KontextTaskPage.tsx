import {
  AlertTriangle,
  CircleDashed,
  FileCheck2,
  GitPullRequestArrow,
  RefreshCw,
  ShieldCheck
} from 'lucide-react'
import type {
  KontextRuntimeCapability,
  KontextRuntimeDoctorReport,
  KontextRuntimeProvider
} from '../../../../shared/kontext-runtime-contract'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useKontextRuntimeInspection } from './use-kontext-runtime-inspection'
import { getKontextPageCopy } from './kontext-page-copy'
import { useTranslation } from 'react-i18next'
import { KontextTaskWorkbench } from './KontextTaskWorkbench'

const PROVIDERS: readonly KontextRuntimeProvider[] = ['codex', 'claude']

function runtimeVerdict(
  capability: KontextRuntimeCapability | undefined,
  eligible: boolean
): { label: string; detail: string; tone: 'ready' | 'warning' | 'muted' } {
  const copy = getKontextPageCopy()
  if (!capability) {
    return { label: copy.notReported, detail: copy.noSnapshot, tone: 'muted' }
  }
  if (eligible) {
    return {
      label: copy.ready,
      detail: copy.readyDetail,
      tone: 'ready'
    }
  }
  if (!capability.installed) {
    return {
      label: copy.notInstalled,
      detail: capability.diagnostic ?? copy.cliNotFound,
      tone: 'muted'
    }
  }
  if (!capability.authenticated) {
    return {
      label: copy.signInRequired,
      detail: capability.diagnostic ?? copy.authUnproven,
      tone: 'warning'
    }
  }
  if (capability.billingPath !== 'subscription') {
    return {
      label: copy.billingUnverified,
      detail: capability.billingPath === 'api' ? copy.apiConsent : copy.subscriptionUnproven,
      tone: 'warning'
    }
  }
  return {
    label: copy.capabilityGap,
    detail: copy.capabilityGapDetail,
    tone: 'warning'
  }
}

function RuntimeRow({
  provider,
  capability,
  eligible
}: {
  provider: KontextRuntimeProvider
  capability: KontextRuntimeCapability | undefined
  eligible: boolean
}): React.JSX.Element {
  const copy = getKontextPageCopy()
  const verdict = runtimeVerdict(capability, eligible)
  const title = provider === 'codex' ? 'Codex' : 'Claude'

  return (
    <div className="grid gap-4 border-b border-border px-5 py-4 last:border-b-0 md:grid-cols-[minmax(120px,0.7fr)_minmax(220px,1.5fr)_minmax(180px,1fr)]">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'size-2 rounded-full',
              verdict.tone === 'ready' && 'bg-emerald-500',
              verdict.tone === 'warning' && 'bg-amber-500',
              verdict.tone === 'muted' && 'bg-muted-foreground/35'
            )}
          />
          <span className="text-sm font-medium text-foreground">{title}</span>
        </div>
        <p className="mt-1 truncate pl-4 text-xs text-muted-foreground">
          {capability?.cliVersion ?? capability?.cliPath ?? copy.noCliPath}
        </p>
      </div>
      <div className="min-w-0">
        <div className="text-sm text-foreground">{verdict.label}</div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{verdict.detail}</p>
      </div>
      <div className="flex flex-wrap content-start gap-1.5">
        <Badge variant="outline" className="font-normal">
          {capability?.billingPath === 'subscription'
            ? copy.subscription
            : capability?.billingPath === 'api'
              ? copy.api
              : copy.unknown}
        </Badge>
        <Badge variant="outline" className="font-normal">
          {capability?.supports.structuredOutput ? copy.structured : copy.noStructuredOutput}
        </Badge>
        <Badge variant="outline" className="font-normal">
          {capability?.supports.workspaceSandbox ? copy.sandboxed : copy.noSandboxProof}
        </Badge>
      </div>
    </div>
  )
}

function RuntimeReport({ report }: { report: KontextRuntimeDoctorReport }): React.JSX.Element {
  const copy = getKontextPageCopy()
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background">
      <div className="border-b border-border bg-muted/20 px-5 py-3">
        <h2 className="text-sm font-medium text-foreground">{copy.subscriptionRuntimes}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{copy.eligibilityDescription}</p>
      </div>
      {PROVIDERS.map((provider) => (
        <RuntimeRow
          key={provider}
          provider={provider}
          capability={report.capabilities.find((entry) => entry.provider === provider)}
          eligible={report.eligibleProviders.includes(provider)}
        />
      ))}
    </div>
  )
}

function InspectionPanel(): React.JSX.Element {
  const copy = getKontextPageCopy()
  const { state, refresh } = useKontextRuntimeInspection()

  if (state.status === 'loading') {
    return (
      <div className="flex min-h-44 items-center justify-center rounded-lg border border-border bg-background text-sm text-muted-foreground">
        <CircleDashed className="mr-2 size-4 animate-spin" />
        {copy.inspecting}
      </div>
    )
  }

  if (state.value.status !== 'ready') {
    return (
      <div className="rounded-lg border border-border bg-background p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-medium text-foreground">
              {state.value.status === 'not_configured' ? copy.notConfigured : copy.unavailable}
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{state.value.diagnostic}</p>
          </div>
          <Button variant="outline" size="sm" onClick={refresh} className="shrink-0 gap-1.5">
            <RefreshCw className="size-3.5" />
            {copy.retry}
          </Button>
        </div>
      </div>
    )
  }

  return <RuntimeReport report={state.value.report} />
}

function getEvidenceSteps() {
  const copy = getKontextPageCopy()
  return [
    { label: copy.receipt, icon: ShieldCheck, detail: copy.receiptDetail },
    { label: copy.bundle, icon: GitPullRequestArrow, detail: copy.bundleDetail },
    { label: copy.verification, icon: FileCheck2, detail: copy.verificationDetail }
  ] as const
}

export default function KontextTaskPage(): React.JSX.Element {
  useTranslation()
  const copy = getKontextPageCopy()
  return (
    <div className="flex h-full min-h-0 bg-background">
      <main className="min-w-0 flex-1 overflow-y-auto scrollbar-sleek">
        <div className="mx-auto max-w-5xl px-6 py-8 lg:px-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {copy.executionReadiness}
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                {copy.title}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                {copy.description}
              </p>
            </div>
          </div>

          <div className="mt-7">
            <InspectionPanel />
          </div>

          <KontextTaskWorkbench />

          <section className="mt-8">
            <h2 className="text-sm font-medium text-foreground">{copy.evidenceChain}</h2>
            <div className="mt-3 divide-y divide-border rounded-lg border border-border bg-background">
              {getEvidenceSteps().map((step, index) => {
                const Icon = step.icon
                return (
                  <div key={step.label} className="flex items-center gap-3 px-5 py-3.5">
                    <span className="w-5 text-xs tabular-nums text-muted-foreground">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 text-sm font-medium text-foreground">
                      {step.label}
                    </span>
                    <span className="hidden text-xs text-muted-foreground sm:block">
                      {step.detail}
                    </span>
                  </div>
                )
              })}
            </div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              {copy.integrationBoundary}
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}
