import { Button } from '@/components/ui/button'
import type { KontextOntologyNodeMembers } from '../../../../shared/kontext-ontology-contract'
import { getKontextOntologyCopy } from './kontext-ontology-copy'

/**
 * Each ontology node with what the knowledge graph actually filed under it. A
 * node with no documents is a topic the build imagined but nothing supports;
 * seeing that here is how a person decides to merge or drop it.
 */
export function KontextOntologyNodesPanel({
  nodes,
  disabled,
  onLoad
}: {
  nodes: readonly KontextOntologyNodeMembers[] | null
  disabled: boolean
  onLoad: () => void
}): React.JSX.Element {
  const copy = getKontextOntologyCopy()
  const byParent = new Map<string | null, KontextOntologyNodeMembers[]>()
  for (const node of nodes ?? []) {
    const siblings = byParent.get(node.parentId) ?? []
    siblings.push(node)
    byParent.set(node.parentId, siblings)
  }
  const render = (parentId: string | null, depth: number): React.JSX.Element[] =>
    (byParent.get(parentId) ?? []).map((node) => (
      <li key={node.id} style={{ marginLeft: `${depth * 12}px` }}>
        <details className="rounded-md border border-border bg-muted/30 px-2.5 py-1.5">
          <summary className="cursor-pointer text-sm text-foreground">
            <span className="font-medium">{node.id}</span>
            <span className="ml-2 text-xs text-muted-foreground">
              {node.resourceCount === null
                ? copy.nodeDocumentsUnknown
                : copy.nodeDocuments(node.resourceCount)}
            </span>
          </summary>
          {node.description !== '' && (
            <p className="mt-1 text-xs text-muted-foreground">{node.description}</p>
          )}
          {node.samples.length > 0 && (
            <ul className="mt-1 flex flex-col gap-0.5">
              {node.samples.map((sample) => (
                <li
                  key={`${sample.connectorId}:${sample.externalId}`}
                  className="truncate font-mono text-xs text-foreground"
                >
                  {sample.connectorId}:{sample.externalId}
                </li>
              ))}
            </ul>
          )}
        </details>
        {byParent.has(node.id) && (
          <ul className="mt-1 flex flex-col gap-1">{render(node.id, depth + 1)}</ul>
        )}
      </li>
    ))

  return (
    <div className="mt-1.5">
      <Button variant="secondary" onClick={onLoad} disabled={disabled}>
        {copy.loadNodes}
      </Button>
      {nodes !== null && (
        <ul className="mt-2 flex flex-col gap-1" aria-label={copy.stepNodes}>
          {render(null, 0)}
        </ul>
      )}
    </div>
  )
}
