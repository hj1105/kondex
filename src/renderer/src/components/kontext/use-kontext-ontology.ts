import { useCallback, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import { useKontextEmbeddingActions } from './use-kontext-embedding-actions'
import { pollOntologyProgress } from './kontext-ontology-progress-poll'
import {
  kontextOntologyAddResultSchema,
  kontextOntologyCheckResultSchema,
  kontextOntologyImportResultSchema,
  kontextOntologyInspectResultSchema,
  kontextOntologyMapResultSchema,
  kontextKnowledgeSearchResultSchema,
  kontextOntologyListResultSchema,
  kontextOntologyNodesResultSchema,
  kontextOntologyRepositoriesResultSchema,
  kontextOntologySetupResultSchema,
  type KontextOntologyRepositoriesResult,
  type KontextToolDocumentMapping
} from '../../../../shared/kontext-ontology-contract'
import type { KontextRequestOwner } from './kontext-request-journal'

/** Setup drives a model over every collected document, so it outlives a normal RPC wait. */
const SETUP_TIMEOUT_MS = 61 * 60 * 1000
// Why: must outlast the host's own command budget. Giving up first reports a command
// that is still running — and may already have written the file — as a failure.
const QUICK_TIMEOUT_MS = 61 * 60 * 1000

export {
  EMPTY_ONTOLOGY_STATE,
  type AddSourceInput,
  type OntologyAction,
  type OntologyState
} from './kontext-ontology-state'
import {
  type AddSourceInput,
  EMPTY_ONTOLOGY_STATE as EMPTY,
  type OntologyAction,
  type OntologyState
} from './kontext-ontology-state'

export function useKontextOntology(owner: KontextRequestOwner, workspace: string) {
  const [state, setState] = useState<OntologyState>(EMPTY)
  // Why: a slow setup must not have a later action's result overwrite it, and a
  // workspace change must not show one workspace's sources under another's name.
  const token = useRef(0)
  // Why: the caller rebuilds `owner` on every render, so depending on its identity
  // would rerun the load effect each time and spawn a CLI process per parent render.
  // Rebuilding it from its own serialization keys the actions to the owner's value.
  const ownerKey = JSON.stringify(owner)
  const stableOwner = useMemo(() => JSON.parse(ownerKey) as KontextRequestOwner, [ownerKey])

  const call = useCallback(
    async <T>(
      action: OntologyAction,
      method: string,
      params: Record<string, unknown>,
      parse: (value: unknown) => T,
      timeoutMs: number
    ): Promise<T | null> => {
      const current = (token.current += 1)
      setState((previous) => ({
        ...previous,
        busy: action,
        error: null,
        errorAction: null,
        notice: null
      }))
      try {
        const response = await callRuntimeRpc<unknown>(stableOwner, method, params, {
          expectedEnvironmentPairingRevision:
            stableOwner.kind === 'environment' ? stableOwner.pairingRevision : undefined,
          timeoutMs
        })
        if (current !== token.current) {
          return null
        }
        return parse(response)
      } catch (caught) {
        if (current !== token.current) {
          return null
        }
        setState((previous) => ({
          ...previous,
          error: caught instanceof Error ? caught.message : String(caught),
          errorAction: action
        }))
        return null
      } finally {
        if (current === token.current) {
          setState((previous) => ({ ...previous, busy: null }))
        }
      }
    },
    [stableOwner]
  )

  const refresh = useCallback(async (): Promise<void> => {
    const result = await call(
      'list',
      'kontext.listOntologySources',
      { workspacePath: workspace },
      (value) => kontextOntologyListResultSchema.parse(value),
      QUICK_TIMEOUT_MS
    )
    if (result) {
      // Checks describe the previous source set, so they stop applying here.
      setState((previous) => ({
        ...previous,
        sources: result.sources,
        checks: null,
        embedding: result.embedding ?? null
      }))
    }
  }, [call, workspace])

  const loadNodes = useCallback(async (): Promise<void> => {
    const result = await call(
      'nodes',
      'kontext.listOntologyNodes',
      { workspacePath: workspace },
      (value) => kontextOntologyNodesResultSchema.parse(value),
      QUICK_TIMEOUT_MS
    )
    if (result) {
      setState((previous) => ({ ...previous, nodes: result.nodes }))
    }
  }, [call, workspace])

  const searchKnowledge = useCallback(
    async (question: string, ontologyNodeIds?: readonly string[]): Promise<void> => {
      const result = await call(
        'search',
        'kontext.searchKnowledge',
        {
          workspacePath: workspace,
          question,
          ...(ontologyNodeIds && ontologyNodeIds.length > 0 ? { ontologyNodeIds } : {})
        },
        (value) => kontextKnowledgeSearchResultSchema.parse(value),
        QUICK_TIMEOUT_MS
      )
      if (result) {
        setState((previous) => ({ ...previous, lastSearch: result }))
      }
    },
    [call, workspace]
  )

  const importSources = useCallback(
    async (includeMarkdown: boolean, apply: boolean): Promise<void> => {
      const result = await call(
        'import',
        'kontext.importOntologySources',
        { workspacePath: workspace, includeMarkdown, apply },
        (value) => kontextOntologyImportResultSchema.parse(value),
        QUICK_TIMEOUT_MS
      )
      if (!result) {
        return
      }
      setState((previous) => ({ ...previous, lastImport: result, importWasPreview: !apply }))
      if (result.written) {
        await refresh()
      }
    },
    [call, refresh, workspace]
  )

  const addSource = useCallback(
    async (input: AddSourceInput): Promise<boolean> => {
      const result = await call(
        'add',
        'kontext.addOntologySource',
        { workspacePath: workspace, apply: true, ...input },
        (value) => kontextOntologyAddResultSchema.parse(value),
        QUICK_TIMEOUT_MS
      )
      if (!result) {
        return false
      }
      await refresh()
      return true
    },
    [call, refresh, workspace]
  )

  const listRepositories = useCallback(
    async (owner: string): Promise<KontextOntologyRepositoriesResult | null> =>
      call(
        'repositories',
        'kontext.listGithubRepositories',
        { workspacePath: workspace, owner },
        (value) => kontextOntologyRepositoriesResultSchema.parse(value),
        QUICK_TIMEOUT_MS
      ),
    [call, workspace]
  )

  const inspectSource = useCallback(
    async (name: string): Promise<void> => {
      const result = await call(
        'inspect',
        'kontext.inspectOntologySource',
        { workspacePath: workspace, name },
        (value) => kontextOntologyInspectResultSchema.parse(value),
        QUICK_TIMEOUT_MS
      )
      if (result) {
        setState((previous) => ({ ...previous, inspection: result }))
      }
    },
    [call, workspace]
  )

  const mapSource = useCallback(
    async (name: string, documents: KontextToolDocumentMapping): Promise<boolean> => {
      const result = await call(
        'map',
        'kontext.mapOntologySource',
        { workspacePath: workspace, name, documents, apply: true },
        (value) => kontextOntologyMapResultSchema.parse(value),
        QUICK_TIMEOUT_MS
      )
      if (!result) {
        return false
      }
      await refresh()
      return true
    },
    [call, refresh, workspace]
  )

  const { setEmbedding, embedKnowledge } = useKontextEmbeddingActions({
    call,
    workspace,
    stableOwner,
    setState
  })

  const check = useCallback(async (): Promise<void> => {
    const result = await call(
      'check',
      'kontext.checkOntologySources',
      { workspacePath: workspace },
      (value) => kontextOntologyCheckResultSchema.parse(value),
      QUICK_TIMEOUT_MS
    )
    if (result) {
      setState((previous) => ({ ...previous, checks: result.sources }))
    }
  }, [call, workspace])

  const setup = useCallback(
    async (targetNodeCount: number | undefined, apply: boolean): Promise<void> => {
      const stopPolling = pollOntologyProgress(stableOwner, workspace, (progress) =>
        setState((previous) => ({ ...previous, progress }))
      )
      try {
        const result = await call(
          'setup',
          'kontext.setupOntology',
          {
            workspacePath: workspace,
            apply,
            ...(targetNodeCount === undefined ? {} : { targetNodeCount })
          },
          (value) => kontextOntologySetupResultSchema.parse(value),
          SETUP_TIMEOUT_MS
        )
        if (result) {
          setState((previous) => ({ ...previous, lastSetup: result }))
          toast.success(
            apply
              ? translate('kondex.ontology.builtToast', 'Ontology saved: {{count}} nodes', {
                  count: result.nodeIds.length
                })
              : translate(
                  'kondex.ontology.previewedToast',
                  'Ontology preview ready: {{count}} nodes',
                  {
                    count: result.nodeIds.length
                  }
                )
          )
          if (apply) {
            await loadNodes()
          }
        }
      } finally {
        stopPolling()
        setState((previous) => ({ ...previous, progress: null }))
      }
    },
    [call, loadNodes, stableOwner, workspace]
  )

  const reset = useCallback(() => {
    token.current += 1
    setState(EMPTY)
  }, [])

  return {
    state,
    refresh,
    importSources,
    addSource,
    listRepositories,
    check,
    setup,
    loadNodes,
    searchKnowledge,
    inspectSource,
    mapSource,
    setEmbedding,
    embedKnowledge,
    reset
  }
}
