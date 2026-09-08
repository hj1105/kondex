import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import { discoverSkillsForRuntimeTarget } from '@/runtime/runtime-skills-client'
import { useActiveSkillDiscoveryRuntimeTarget } from '@/hooks/use-active-skill-discovery-runtime-target'
import { useMountedRef } from '@/hooks/useMountedRef'
import type { DiscoveredSkill, SkillDiscoveryResult } from '../../../../shared/skills'
import { SkillsList } from './SkillsList'
import { SkillsPageHeader } from './SkillsPageHeader'
import { SkillsFilterToolbar } from './SkillsFilterToolbar'
import { SkillsSelectionHeader } from './SkillsSelectionHeader'
import {
  SkillsEmptyState,
  SkillsListSkeleton,
  SkillsNoMatchesState,
  SkillsScanErrorBand
} from './skills-page-states'
import { SKILLS_PAGE_COLUMN } from './skills-page-column'
import { scannedSkillSourceCount, summarizeSkillSources } from './skill-source-inventory'
import { useSkillDiscoveryHostLabel } from './use-skill-discovery-host-label'
import { countSkillsBySource, filterSkills, type SkillsFilterState } from './skills-filter'
import { skillAgentByRootPath, skillAgentOptions } from './skill-agent-filter'
import { useSkillsPageKeyboardNavigation } from './use-skills-page-keyboard-navigation'
import { translate } from '@/i18n/i18n'
import {
  INSTALLED_AGENT_SKILLS_CHANGED_EVENT,
  INSTALLED_AGENT_SKILLS_REFRESHED_EVENT
} from '@/hooks/installed-agent-skills-change-event'
import {
  addDeletableSkillResults,
  eligibleDeleteSkillCount,
  retainedDeletableSkillSelection,
  updatedSkillSelection
} from './skill-delete-selection'
import { skillDeleteActionLabel } from './skill-delete-copy'
import { SkillDeleteResultBand } from './SkillDeleteResultBand'
import { useSkillDeleteFlow } from './use-skill-delete-flow'

const EMPTY_SKILLS: DiscoveredSkill[] = []
const NO_FILTERS: SkillsFilterState = {
  query: '',
  sourceKind: 'all',
  agent: 'all'
}

export default function SkillsPage(): React.JSX.Element {
  const closeSkillsPage = useAppStore((s) => s.closeSkillsPage)
  const runtimeTarget = useActiveSkillDiscoveryRuntimeTarget()
  const hostLabel = useSkillDiscoveryHostLabel(runtimeTarget)
  const [result, setResult] = useState<SkillDiscoveryResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [scanError, setScanError] = useState<string | null>(null)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedSkillIds, setSelectedSkillIds] = useState<Set<string>>(() => new Set())
  const [filters, setFilters] = useState<SkillsFilterState>(NO_FILTERS)
  const mountedRef = useMountedRef()
  const scanGenerationRef = useRef(0)
  // Why a ref: `loadSkills` must not re-identify (and re-scan) when the user
  // merely switches selection mode. Switching modes clears the selection anyway,
  // so a one-render lag here cannot retain the wrong rows.
  const selectionModeRef = useRef(selectionMode)
  useEffect(() => {
    selectionModeRef.current = selectionMode
  }, [selectionMode])

  const loadSkills = useCallback(
    async (refresh = false): Promise<void> => {
      setLoading(true)
      // Why: a cold local scan walks every skill root, so switching runtimes can
      // land a stale result after a newer one. Only the newest scan may write.
      const scanGeneration = ++scanGenerationRef.current
      const isCurrentScan = (): boolean =>
        mountedRef.current && scanGeneration === scanGenerationRef.current
      if (!runtimeTarget) {
        // Why: keep scanning until the owning runtime is known, rather than
        // showing the client's skills to someone whose skills live remotely.
        return
      }
      try {
        const nextResult = await discoverSkillsForRuntimeTarget(
          runtimeTarget,
          refresh ? { refresh: true } : undefined
        )
        if (isCurrentScan()) {
          setResult(nextResult)
          setScanError(null)
          setSelectedSkillIds((current) =>
            selectionModeRef.current
              ? retainedDeletableSkillSelection(current, nextResult.skills)
              : new Set()
          )
        }
      } catch (error) {
        console.error('Failed to discover skills:', error)
        if (isCurrentScan()) {
          // Why: a failed scan needs to stay on screen with a retry — a toast
          // disappears before the user can act on it.
          setScanError(
            translate('auto.components.skills.SkillsPage.ea72d6185b', 'Could not scan skills')
          )
        }
      } finally {
        if (isCurrentScan()) {
          setLoading(false)
        }
      }
    },
    [mountedRef, runtimeTarget]
  )

  useEffect(() => {
    void loadSkills()
  }, [loadSkills])

  useEffect(() => {
    const refresh = (): void => void loadSkills()
    window.addEventListener(INSTALLED_AGENT_SKILLS_CHANGED_EVENT, refresh)
    return () => window.removeEventListener(INSTALLED_AGENT_SKILLS_CHANGED_EVENT, refresh)
  }, [loadSkills])

  const exitSelection = useCallback((): void => {
    setSelectionMode(false)
    setSelectedSkillIds(new Set())
  }, [])

  const deleteFlow = useSkillDeleteFlow(runtimeTarget, hostLabel, () => {
    exitSelection()
    // Why an explicit refresh instead of firing the change event: this page
    // would then run a second, non-refresh scan of the host it just refreshed.
    // Other subscribers (settings badges, pickers) still hear the event.
    void loadSkills(true)
    window.dispatchEvent(new Event(INSTALLED_AGENT_SKILLS_REFRESHED_EVENT))
  })

  useSkillsPageKeyboardNavigation({
    closeSkillsPage,
    exitSelection,
    selectionMode
  })

  const skills = result?.skills ?? EMPTY_SKILLS
  const agentByRootPath = useMemo(() => skillAgentByRootPath(result), [result])
  const agentOptions = useMemo(() => skillAgentOptions(result), [result])
  const visibleSkills = useMemo(
    () => filterSkills(skills, filters, agentByRootPath),
    [agentByRootPath, filters, skills]
  )
  const sourceCounts = useMemo(() => countSkillsBySource(skills), [skills])
  const sourceEntries = useMemo(() => summarizeSkillSources(result), [result])
  const eligibleCount = eligibleDeleteSkillCount(visibleSkills)
  const addSelected = (
    current: ReadonlySet<string>,
    results: readonly DiscoveredSkill[]
  ): Set<string> => addDeletableSkillResults(current, skills, results)

  return (
    <main className="flex min-h-0 flex-1 flex-col bg-background">
      {selectionMode ? (
        <SkillsSelectionHeader
          title={translate(
            'auto.components.skills.SkillsSelectionHeader.deleteTitle',
            'Select skills to delete'
          )}
          icon={<Trash2 className="size-4 shrink-0 text-muted-foreground" />}
          actionIcon={<Trash2 className="size-3.5" />}
          actionLabel={skillDeleteActionLabel(selectedSkillIds.size)}
          destructive
          busy={deleteFlow.running}
          selectedCount={selectedSkillIds.size}
          eligibleCount={eligibleCount}
          onSelectAll={() => setSelectedSkillIds((current) => addSelected(current, visibleSkills))}
          onClear={() => setSelectedSkillIds(new Set())}
          onCancel={exitSelection}
          onSubmit={() => {
            const selected = skills.filter((skill) => selectedSkillIds.has(skill.id))
            void deleteFlow.requestDelete(selected)
          }}
        />
      ) : (
        <SkillsPageHeader
          skillCount={skills.length}
          sourceEntries={sourceEntries}
          scannedSourceCount={scannedSkillSourceCount(sourceEntries)}
          hostLabel={hostLabel}
          onClose={closeSkillsPage}
          deleteSupported={deleteFlow.supported}
          deleteUnsupportedReason={deleteFlow.unsupportedReason}
          onStartDelete={() => {
            setSelectionMode(true)
            setSelectedSkillIds(new Set())
          }}
        />
      )}
      <SkillsFilterToolbar
        filters={filters}
        agentOptions={agentOptions}
        sourceCounts={sourceCounts}
        totalCount={skills.length}
        resultCount={visibleSkills.length}
        loading={loading}
        onFiltersChange={setFilters}
        onRefresh={() => {
          deleteFlow.reprobe()
          void loadSkills()
        }}
      />
      {scanError ? (
        <SkillsScanErrorBand
          message={scanError}
          disabled={loading}
          onRetry={() => {
            deleteFlow.reprobe()
            void loadSkills()
          }}
        />
      ) : null}
      {deleteFlow.result ? (
        <SkillDeleteResultBand result={deleteFlow.result} onDismiss={deleteFlow.dismissResult} />
      ) : null}

      <section className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto">
        <div className={cn(SKILLS_PAGE_COLUMN, 'py-2')} data-skills-page-list="true">
          {loading && skills.length === 0 ? (
            <SkillsListSkeleton />
          ) : visibleSkills.length > 0 ? (
            <SkillsList
              skills={visibleSkills}
              agentByRootPath={agentByRootPath}
              selectedIds={selectedSkillIds}
              selectionMode={selectionMode}
              deleteSupported={deleteFlow.supported}
              deleteUnsupportedReason={deleteFlow.unsupportedReason}
              onSelectedChange={(skillId, selected) =>
                setSelectedSkillIds((current) => updatedSkillSelection(current, skillId, selected))
              }
              onSelectResults={(results) =>
                setSelectedSkillIds((current) => addSelected(current, results))
              }
              onDelete={(skill) => void deleteFlow.requestDelete([skill])}
            />
          ) : skills.length > 0 ? (
            <SkillsNoMatchesState onClearFilters={() => setFilters(NO_FILTERS)} />
          ) : (
            <SkillsEmptyState
              onRefresh={() => {
                deleteFlow.reprobe()
                void loadSkills()
              }}
            />
          )}
        </div>
      </section>
    </main>
  )
}
