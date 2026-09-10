import { useCallback, useMemo, useRef, useState } from 'react'
import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import {
  kontextOntologyAddResultSchema,
  kontextOntologyCheckResultSchema,
  kontextOntologyImportResultSchema,
  kontextOntologyListResultSchema,
  kontextOntologyRepositoriesResultSchema,
  kontextOntologySetupResultSchema,
  type KontextOntologyCheckResult,
  type KontextOntologyRepositoriesResult,
  type KontextOntologyImportResult,
  type KontextOntologySetupResult,
  type KontextOntologySource
} from '../../../../shared/kontext-ontology-contract'
import type { KontextRequestOwner } from './kontext-request-journal'

/** Setup drives a model over every collected document, so it outlives a normal RPC wait. */
const SETUP_TIMEOUT_MS = 61 * 60 * 1000
// Why: must outlast the host's own command budget. Giving up first reports a command
// that is still running — and may already have written the file — as a failure.
const QUICK_TIMEOUT_MS = 61 * 60 * 1000

export type OntologyAction = 'list' | 'import' | 'add' | 'repositories' | 'check' | 'setup'

export type OntologyState = {
  readonly sources: readonly KontextOntologySource[] | null
  readonly checks: KontextOntologyCheckResult['sources'] | null
  readonly lastImport: KontextOntologyImportResult | null
  /** True when lastImport came from a preview, so nothing was written. */
  readonly importWasPreview: boolean
  readonly lastSetup: KontextOntologySetupResult | null
  readonly busy: OntologyAction | null
  readonly error: string | null
  /** Which action the error belongs to, so it can be shown beside that step's controls. */
  readonly errorAction: OntologyAction | null
  readonly notice: string | null
}

const EMPTY: OntologyState = {
  sources: null,
  checks: null,
  lastImport: null,
  importWasPreview: false,
  lastSetup: null,
  busy: null,
  error: null,
  errorAction: null,
  notice: null
}

export type AddSourceInput = {
  name: string
  transport: 'stdio' | 'sse' | 'local' | 'git'
  command?: string
  /** Kept apart from `command`: the server is spawned without a shell. */
  args?: readonly string[]
  /** stdio: what the server needs in its environment, such as a token. */
  env?: Readonly<Record<string, string>>
  /** sse: server URL; git: repository to clone. */
  url?: string
  /** git: branch or tag; the remote default when omitted. */
  ref?: string
  path?: string
  type?: 'notion' | 'jira' | 'github_pr' | 'slack'
  /** local/git: read source files too, so code lands on ontology nodes beside its docs. */
  code?: boolean
}

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
      setState((previous) => ({ ...previous, sources: result.sources, checks: null }))
    }
  }, [call, workspace])

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
      }
    },
    [call, workspace]
  )

  const reset = useCallback(() => {
    token.current += 1
    setState(EMPTY)
  }, [])

  return { state, refresh, importSources, addSource, listRepositories, check, setup, reset }
}
