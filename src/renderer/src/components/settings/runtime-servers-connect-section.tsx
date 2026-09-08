import { Plus } from 'lucide-react'
import type { PublicKnownRuntimeEnvironment } from '../../../../shared/runtime-environments'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { Button } from '../ui/button'
import type { RuntimeHostDetails } from './runtime-environment-host-details'
import { RuntimeHostAccessForm, type RuntimeHostAccessFailure } from './RuntimeHostAccessForm'
import { RuntimeServerRow } from './runtime-server-row'

type RuntimeServersConnectSectionProps = {
  visible: boolean
  environments: PublicKnownRuntimeEnvironment[]
  detailsByEnvironmentId: Record<string, RuntimeHostDetails>
  activeRuntimeEnvironmentId: string | null | undefined
  addServerFormOpen: boolean
  name: string
  pairingCode: string
  addServerFailure: RuntimeHostAccessFailure | null
  isBusy: boolean
  connectingId: string | null
  switchingValue: string | null
  disconnectingId: string | null
  removingId: string | null
  onOpenAddServerForm: () => void
  onCloseAddServerForm: () => void
  onNameChange: (value: string) => void
  onPairingCodeChange: (value: string) => void
  onAddEnvironment: (allowLoopback: boolean) => void
  onConnect: (environment: PublicKnownRuntimeEnvironment) => void
  onDisconnect: (environment: PublicKnownRuntimeEnvironment) => void
  onRemove: (environment: PublicKnownRuntimeEnvironment) => void
}

export function RuntimeServersConnectSection({
  visible,
  environments,
  detailsByEnvironmentId,
  activeRuntimeEnvironmentId,
  addServerFormOpen,
  name,
  pairingCode,
  addServerFailure,
  isBusy,
  connectingId,
  switchingValue,
  disconnectingId,
  removingId,
  onOpenAddServerForm,
  onCloseAddServerForm,
  onNameChange,
  onPairingCodeChange,
  onAddEnvironment,
  onConnect,
  onDisconnect,
  onRemove
}: RuntimeServersConnectSectionProps): React.JSX.Element {
  return (
    <div className={cn('space-y-3', !visible && 'hidden')}>
      <div
        data-settings-section="remote-servers"
        className="flex items-center justify-between gap-3"
      >
        <div className="min-w-0 space-y-0.5">
          <div className="text-sm font-medium">
            {translate(
              'auto.components.settings.RuntimeEnvironmentsPane.connectToRemoteServers',
              'Connect to remote servers'
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {translate(
              'auto.components.settings.RuntimeEnvironmentsPane.connectToRemoteServersHelp',
              'Pair another Kondex runtime, then connect or disconnect it here.'
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {addServerFormOpen ? null : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={onOpenAddServerForm}
              disabled={isBusy}
            >
              <Plus />
              {translate(
                'auto.components.settings.RuntimeEnvironmentsPane.9bee6bbeeb',
                'Add Server'
              )}
            </Button>
          )}
        </div>
      </div>

      {addServerFormOpen ? (
        <RuntimeHostAccessForm
          name={name}
          accessLink={pairingCode}
          busy={isBusy}
          failure={addServerFailure}
          onNameChange={onNameChange}
          onAccessLinkChange={onPairingCodeChange}
          onCancel={onCloseAddServerForm}
          onSubmit={onAddEnvironment}
        />
      ) : null}

      <div className="rounded-lg border border-border/50 bg-card/30">
        {environments.length === 0 ? (
          <div className="px-3 py-4 text-sm text-muted-foreground">
            {translate(
              'auto.components.settings.RuntimeEnvironmentsPane.9a3758d983',
              'No saved servers.'
            )}
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {environments.map((environment) => (
              <RuntimeServerRow
                key={environment.id}
                environment={environment}
                details={detailsByEnvironmentId[environment.id]}
                isActive={activeRuntimeEnvironmentId === environment.id}
                connecting={connectingId === environment.id}
                switching={switchingValue === environment.id}
                disconnecting={disconnectingId === environment.id}
                removing={removingId === environment.id}
                isBusy={isBusy}
                onConnect={onConnect}
                onDisconnect={onDisconnect}
                onRemove={onRemove}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
