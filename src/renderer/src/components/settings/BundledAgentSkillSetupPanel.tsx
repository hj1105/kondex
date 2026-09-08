import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, RefreshCw } from 'lucide-react'
import type { BundledSkillInstallRequest } from '../../../../shared/bundled-skill-install-contract'
import { useActiveProjectSkillRuntime } from '@/hooks/useActiveProjectSkillRuntime'
import { useActiveSkillDiscoveryRuntimeTarget } from '@/hooks/use-active-skill-discovery-runtime-target'
import {
  GLOBAL_AGENT_SKILL_SOURCE_KINDS,
  notifyInstalledAgentSkillsChanged,
  useInstalledAgentSkill
} from '@/hooks/useInstalledAgentSkills'
import { useMountedRef } from '@/hooks/useMountedRef'
import { installBundledSkillsOnRuntimeTarget } from '@/runtime/runtime-bundled-skills-client'
import type { RuntimeClientTarget } from '@/runtime/runtime-rpc-client'
import { Button } from '../ui/button'
import { Checkbox } from '../ui/checkbox'
import { IntegrationStatusPill } from '../integration-status-pill'
import { SkillFreshnessStatusPill } from '../skills/SkillFreshnessStatusPill'
import { refreshSkillFreshness } from '@/hooks/useSkillFreshness'
import { cn } from '@/lib/utils'
import {
  bundledSkillInstallDescription,
  getBundledSkillSetupCopy,
  missingBundledSkillResult
} from './bundled-skill-setup-copy'

type SkillRuntime = Pick<
  ReturnType<typeof useActiveProjectSkillRuntime>,
  'agentRuntime' | 'discoveryTarget' | 'installDisabledReason'
>
type Props = {
  title: string
  description: string
  skillName: string
  icon?: ReactNode
  className?: string
  variant?: 'card' | 'inline'
  hideHeader?: boolean
  leading?: ReactNode
  footer?: ReactNode
  installDisabled?: boolean
  showInstallWhenInstalled?: boolean
  runtimeOverride?: SkillRuntime
  targetOverride?: RuntimeClientTarget
  discoveryState?: {
    installed: boolean
    loading: boolean
    error: string | null
    refresh: () => void | Promise<unknown>
  }
  onBeforeInstall?: () => void | Promise<unknown>
}
type GlobalDestination = Extract<BundledSkillInstallRequest['destination'], { scope: 'global' }>

export function BundledAgentSkillSetupPanel(props: Props): React.JSX.Element {
  const activeTarget = useActiveSkillDiscoveryRuntimeTarget()
  const activeRuntime = useActiveProjectSkillRuntime()
  const target = props.targetOverride ?? activeTarget
  const runtime = props.runtimeOverride ?? activeRuntime
  const destination: GlobalDestination = {
    scope: 'global',
    executionTarget:
      target?.kind === 'local' && runtime.agentRuntime?.runtime === 'wsl'
        ? { kind: 'wsl', distro: runtime.agentRuntime.wslDistro ?? '' }
        : { kind: 'host' }
  }
  const key = JSON.stringify([target, destination, props.skillName])
  return (
    <BundledSkillSetupAction
      key={key}
      {...props}
      target={target}
      destination={destination}
      runtime={runtime}
    />
  )
}

function BundledSkillSetupAction({
  title,
  description,
  skillName,
  icon,
  className,
  variant = 'card',
  hideHeader,
  leading,
  footer,
  installDisabled,
  showInstallWhenInstalled = true,
  discoveryState,
  onBeforeInstall,
  target,
  destination,
  runtime
}: Props & {
  target: RuntimeClientTarget | null
  destination: GlobalDestination
  runtime: SkillRuntime
}): React.JSX.Element {
  useTranslation()
  const copy = getBundledSkillSetupCopy()
  const observed = useInstalledAgentSkill(skillName, {
    enabled: !discoveryState,
    discoveryTarget: runtime.discoveryTarget,
    sourceKinds: GLOBAL_AGENT_SKILL_SOURCE_KINDS
  })
  const discovery = discoveryState ?? observed
  const showLocalFreshness =
    !hideHeader && target?.kind === 'local' && destination.executionTarget?.kind === 'host'
  const [providers, setProviders] = useState<('codex' | 'claude')[]>(['codex', 'claude'])
  const [running, setRunning] = useState(false)
  const [visibleProgress, setVisibleProgress] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const pending = useRef(false)
  const mounted = useMountedRef()
  useEffect(() => {
    if (!running) {
      setVisibleProgress(false)
      return
    }
    const timer = setTimeout(() => setVisibleProgress(true), 200)
    return () => clearTimeout(timer)
  }, [running])
  const disabledReason = !target
    ? copy.selectRuntime
    : (runtime.installDisabledReason ?? (installDisabled ? copy.setupFirst : null))
  const install = async (): Promise<void> => {
    if (!target || disabledReason || pending.current) {
      return
    }
    pending.current = true
    setRunning(true)
    setFailure(null)
    try {
      // CLI registration APIs are client-local; never run them for a paired host.
      if (target.kind === 'local') {
        await onBeforeInstall?.()
      }
      const result = await installBundledSkillsOnRuntimeTarget(target, {
        operationId: crypto.randomUUID(),
        skillNames: [skillName],
        providers: [...providers],
        destination
      })
      if (
        result.status !== 'complete' ||
        result.skills.length !== 1 ||
        result.skills.some((skill) => !['installed', 'updated', 'unchanged'].includes(skill.status))
      ) {
        throw new Error(
          result.skills
            .map(
              (skill) =>
                `${skill.name}: ${skill.status}${skill.errorCategory ? ` (${skill.errorCategory})` : ''}`
            )
            .join('; ') || missingBundledSkillResult(result.status)
        )
      }
    } catch (error) {
      if (mounted.current) {
        setFailure(error instanceof Error ? error.message : copy.installFailed)
      }
    } finally {
      notifyInstalledAgentSkillsChanged()
      try {
        await discovery.refresh()
      } catch (error) {
        if (mounted.current) {
          setFailure(
            (previous) => previous ?? (error instanceof Error ? error.message : copy.recheckFailed)
          )
        }
      } finally {
        pending.current = false
        if (mounted.current) {
          setRunning(false)
        }
      }
    }
  }
  const recheck = async (): Promise<void> => {
    try {
      await discovery.refresh()
      if (showLocalFreshness) {
        await refreshSkillFreshness()
      }
      if (mounted.current) {
        setFailure(null)
      }
    } catch (error) {
      if (mounted.current) {
        setFailure(error instanceof Error ? error.message : copy.recheckFailed)
      }
    }
  }
  return (
    <section
      className={cn(
        'min-w-0',
        variant === 'card'
          ? 'rounded-xl border border-border bg-card p-5 text-card-foreground'
          : 'pt-1.5',
        className
      )}
    >
      {!hideHeader ? (
        <div className="flex items-center gap-3">
          {leading}
          {icon}
          <h3 className="text-sm font-semibold">{title}</h3>
          {discovery.installed && !discovery.loading && showLocalFreshness ? (
            <SkillFreshnessStatusPill skillName={skillName} />
          ) : (
            <IntegrationStatusPill tone={discovery.installed ? 'connected' : 'neutral'}>
              {discovery.loading
                ? copy.checking
                : discovery.installed
                  ? copy.installed
                  : discovery.error
                    ? copy.unknown
                    : copy.notInstalled}
            </IntegrationStatusPill>
          )}
        </div>
      ) : null}
      <p className="mt-3 text-[13px] text-muted-foreground">{description}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        {bundledSkillInstallDescription(
          target?.kind === 'environment'
            ? target.environmentId
            : destination.executionTarget?.kind === 'wsl'
              ? `WSL ${destination.executionTarget.distro}`
              : copy.here
        )}
      </p>
      <fieldset disabled={running || Boolean(disabledReason)} className="mt-3 flex gap-4">
        <legend className="mb-2 text-xs text-muted-foreground">{copy.integrations}</legend>
        {(['codex', 'claude'] as const).map((provider) => (
          <label key={provider} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={providers.includes(provider)}
              onCheckedChange={(checked) =>
                setProviders((selected) =>
                  checked === true
                    ? [...selected.filter((value) => value !== provider), provider]
                    : selected.filter((value) => value !== provider)
                )
              }
            />
            {provider === 'codex' ? copy.codex : copy.claude}
          </label>
        ))}
      </fieldset>
      <div className="mt-3 flex items-center gap-2">
        {!discovery.installed || showInstallWhenInstalled ? (
          <Button
            size="sm"
            variant="outline"
            className="w-32"
            disabled={running || Boolean(disabledReason)}
            onClick={() => void install()}
          >
            {visibleProgress ? <Loader2 className="size-4 animate-spin" /> : null}
            {visibleProgress ? copy.installing : discovery.installed ? copy.update : copy.install}
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          disabled={running || discovery.loading}
          onClick={() => void recheck()}
        >
          <RefreshCw className="size-4" />
          {copy.recheck}
        </Button>
      </div>
      {failure || disabledReason || discovery.error ? (
        <p role="alert" className="mt-3 text-xs text-destructive">
          {failure ?? disabledReason ?? discovery.error}
        </p>
      ) : null}
      {footer ? <div className="mt-5 border-t border-border pt-4">{footer}</div> : null}
    </section>
  )
}
