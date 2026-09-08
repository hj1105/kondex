import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { KontextTaskInventoryRow } from '../../../../shared/kontext-task-inventory-contract'
import type { KontextRequestOwner } from './kontext-request-journal'
import { useKontextTaskInventory } from './use-kontext-task-inventory'
import { getKontextTaskInventoryCopy } from './kontext-task-inventory-copy'
import { getKontextWorkbenchCopy } from './kontext-workbench-copy'
import { getKontextFinalizationCopy } from './kontext-finalization-copy'
import { KontextTaskFinalization } from './KontextTaskFinalization'
import { KontextScheduleHistory } from './KontextScheduleHistory'

type Props = {
  owner: KontextRequestOwner
  disabled: boolean
  onSelect: (task: KontextTaskInventoryRow) => void
}
export function KontextTaskInventory(props: Props) {
  return <TaskInventory key={JSON.stringify(props.owner)} {...props} />
}
function TaskInventory({ owner, disabled, onSelect }: Props) {
  useTranslation()
  const copy = getKontextTaskInventoryCopy()
  const statusCopy = getKontextWorkbenchCopy()
  const inventory = useKontextTaskInventory(owner)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = inventory.page?.tasks.find((row) => row.taskId === selectedId)
  const rows =
    inventory.page?.tasks.filter((row) =>
      `${row.intent} ${row.taskId} ${row.workspacePath}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase())
    ) ?? []
  return (
    <section
      className="mt-7 space-y-3 border-t border-border pt-6"
      aria-labelledby="kontext-inventory-heading"
    >
      <h2 id="kontext-inventory-heading" className="text-sm font-medium">
        {copy.title}
      </h2>
      <p className="text-xs leading-5 text-muted-foreground">{copy.notice}</p>
      <Button
        variant="outline"
        disabled={disabled || inventory.busy}
        onClick={() => {
          setSelectedId(null)
          void inventory.load()
        }}
      >
        {copy.load}
      </Button>
      {inventory.progress && (
        <p role="status" className="text-xs text-muted-foreground">
          {getKontextFinalizationCopy().busy}
        </p>
      )}
      {inventory.failed && (
        <p role="alert" className="text-xs text-destructive">
          {copy.error}
        </p>
      )}
      {inventory.page && (
        <>
          <Input
            aria-label={copy.search}
            placeholder={copy.search}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {rows.length === 0 && <p className="text-xs text-muted-foreground">{copy.empty}</p>}
          <ul className="max-h-80 divide-y divide-border overflow-y-auto scrollbar-sleek">
            {rows.map((row) => (
              <li
                key={row.taskId}
                className={cn('space-y-2 py-3', row.taskId === selectedId && 'bg-accent')}
                data-current={row.taskId === selectedId}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="break-words text-sm font-medium">{row.intent}</p>
                    <p className="break-all font-mono text-xs text-muted-foreground">
                      {row.workspacePath} · {row.taskId}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={`${copy.open}: ${row.intent}`}
                    disabled={disabled || inventory.busy}
                    onClick={() => {
                      if (disabled || inventory.busy || !inventory.current()) {
                        return
                      }
                      setSelectedId(row.taskId)
                      onSelect(row)
                    }}
                  >
                    {copy.open}
                  </Button>
                </div>
                <dl className="grid gap-x-3 gap-y-1 text-xs sm:grid-cols-[auto_minmax(0,1fr)]">
                  <dt className="text-muted-foreground">{copy.schedule}</dt>
                  <dd className="break-all">
                    {row.latestSchedule
                      ? `${statusCopy[row.latestSchedule.status]} · ${row.latestSchedule.jobId}`
                      : copy.noSchedule}
                  </dd>
                  <dt className="text-muted-foreground">{copy.unsettled}</dt>
                  <dd>
                    {row.unsettledScheduleCount} / {row.scheduleCount}
                  </dd>
                  <dt className="text-muted-foreground">{copy.integration}</dt>
                  <dd className="break-all font-mono">{row.integration?.gitCommit ?? '—'}</dd>
                  <dt className="text-muted-foreground">{copy.history}</dt>
                  <dd>{row.finalization?.completedAt ?? '—'}</dd>
                </dl>
              </li>
            ))}
          </ul>
          {inventory.page.nextCursor && (
            <Button
              variant="outline"
              disabled={disabled || inventory.busy}
              onClick={() => void inventory.load(true)}
            >
              {copy.more}
            </Button>
          )}
          {selected && (
            <KontextScheduleHistory
              key={`${JSON.stringify(owner)}:${selected.taskId}`}
              owner={owner}
              taskId={selected.taskId}
              latestJobId={selected.latestSchedule?.jobId}
              disabled={disabled || inventory.busy}
            />
          )}
          {selected?.finalization && (
            <KontextTaskFinalization
              key={`${selected.taskId}:${selected.finalization.recordId}`}
              owner={owner}
              taskId={selected.taskId}
              jobId={selected.finalization.jobId}
              expectedRecordId={selected.finalization.recordId}
              ready={false}
              disabled={disabled || inventory.busy}
            />
          )}
        </>
      )}
    </section>
  )
}
