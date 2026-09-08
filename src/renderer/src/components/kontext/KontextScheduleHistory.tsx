import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { KontextRequestOwner } from './kontext-request-journal'
import { KontextRegisteredSchedule } from './KontextRegisteredSchedule'
import { getKontextRegisteredScheduleCopy } from './kontext-registered-schedule-copy'
import { getKontextScheduleHistoryCopy } from './kontext-schedule-history-copy'
import { getKontextWorkbenchCopy } from './kontext-workbench-copy'
import { useKontextScheduleHistory } from './use-kontext-schedule-history'

type Props = {
  owner: KontextRequestOwner
  taskId: string
  latestJobId?: string
  disabled: boolean
}
export function KontextScheduleHistory(props: Props) {
  return <ScheduleHistory key={`${JSON.stringify(props.owner)}:${props.taskId}`} {...props} />
}
function ScheduleHistory({ owner, taskId, latestJobId, disabled }: Props) {
  useTranslation()
  const copy = getKontextScheduleHistoryCopy()
  const inventory = useKontextScheduleHistory(owner, taskId)
  const [selectedId, setSelectedId] = useState<string | null>(latestJobId ?? null)
  const [query, setQuery] = useState('')
  const rows =
    inventory.page?.schedules.filter((job) =>
      `${job.jobId} ${job.requestedAt} ${job.codeRevision} ${job.contextDigest} ${getKontextWorkbenchCopy()[job.status]}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase())
    ) ?? []
  const selected =
    !inventory.busy &&
    !inventory.failed &&
    selectedId &&
    (!inventory.page || inventory.page.schedules.some((job) => job.jobId === selectedId))
  return (
    <section
      className="space-y-3 border-t border-border pt-4"
      aria-labelledby="kontext-schedule-history-heading"
    >
      <h3 id="kontext-schedule-history-heading" className="text-sm font-medium">
        {copy.title}
      </h3>
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
          {getKontextRegisteredScheduleCopy().busy}
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
            {rows.map((job) => (
              <li
                key={job.jobId}
                className={cn('space-y-2 py-3', job.jobId === selectedId && 'bg-accent')}
                data-current={job.jobId === selectedId}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1 text-xs">
                    <p className="break-all font-mono">{job.jobId}</p>
                    <p>
                      {getKontextWorkbenchCopy()[job.status]} · {job.requestedAt}
                    </p>
                    <p className="break-all font-mono text-muted-foreground">
                      {job.codeRevision} · {job.contextDigest}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={`${copy.open}: ${job.jobId}`}
                    disabled={disabled || inventory.busy}
                    onClick={() => {
                      if (!disabled && !inventory.busy && inventory.current()) {
                        setSelectedId(job.jobId)
                      }
                    }}
                  >
                    {copy.open}
                  </Button>
                </div>
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
        </>
      )}
      {selected && (
        <KontextRegisteredSchedule
          key={selectedId}
          owner={owner}
          taskId={taskId}
          jobId={selectedId}
          disabled={disabled}
        />
      )}
    </section>
  )
}
