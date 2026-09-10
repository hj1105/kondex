import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { KontextKnowledgeSearchResult } from '../../../../shared/kontext-ontology-contract'
import { getKontextOntologyCopy } from './kontext-ontology-copy'

/**
 * Asks the knowledge graph a question and shows Evidence-cited hits: the same
 * search a worker reaches through the kontext_search_knowledge tool, so what a
 * person sees here is what an agent would be handed.
 */
export function KontextKnowledgeSearchPanel({
  result,
  disabled,
  busy,
  onSearch
}: {
  result: KontextKnowledgeSearchResult | null
  disabled: boolean
  busy: boolean
  onSearch: (question: string) => void
}): React.JSX.Element {
  const copy = getKontextOntologyCopy()
  const [question, setQuestion] = useState('')
  const submit = (): void => {
    if (question.trim() !== '') {
      onSearch(question.trim())
    }
  }
  return (
    <div className="mt-1.5">
      <Label htmlFor="kontext-knowledge-question">{copy.searchQuestion}</Label>
      <div className="mt-1 flex gap-2">
        <Input
          id="kontext-knowledge-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              submit()
            }
          }}
          disabled={disabled}
        />
        <Button onClick={submit} disabled={disabled || question.trim() === ''}>
          {busy ? copy.busy : copy.searchAction}
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{copy.searchHint}</p>
      {result !== null && (
        <div className="mt-2">
          <p role="status" className="text-xs text-muted-foreground">
            {result.hits.length === 0
              ? copy.searchNoHits
              : copy.searchSummary(
                  result.hits.length,
                  result.chunksScanned,
                  result.resourcesScanned
                )}
            {result.mode !== undefined &&
              ` · ${result.mode === 'hybrid' ? copy.searchModeHybrid : copy.searchModeLexical}`}
            {result.embeddingError !== undefined && ` · ${result.embeddingError}`}
          </p>
          <ol className="mt-1 flex flex-col gap-1.5">
            {result.hits.map((hit) => (
              <li key={hit.evidenceId} className="rounded-md border border-border px-2.5 py-1.5">
                <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className="font-medium text-foreground">{hit.title}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {hit.source.connectorId}:{hit.source.externalId}
                  </span>
                  {hit.ontologyNodeIds.map((nodeId) => (
                    <span
                      key={nodeId}
                      className="rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground"
                    >
                      {nodeId}
                    </span>
                  ))}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-xs text-foreground">{hit.text}</p>
                <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
                  {hit.evidenceId}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
