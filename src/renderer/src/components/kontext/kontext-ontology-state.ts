import type {
  KontextKnowledgeSearchResult,
  KontextOntologyCheckResult,
  KontextOntologyImportResult,
  KontextOntologyNodeMembers,
  KontextOntologyProgress,
  KontextOntologySetupResult,
  KontextOntologySource
} from '../../../../shared/kontext-ontology-contract'

export type OntologyAction =
  | 'list'
  | 'import'
  | 'add'
  | 'repositories'
  | 'check'
  | 'setup'
  | 'nodes'
  | 'search'

export type OntologyState = {
  readonly sources: readonly KontextOntologySource[] | null
  readonly checks: KontextOntologyCheckResult['sources'] | null
  readonly lastImport: KontextOntologyImportResult | null
  /** True when lastImport came from a preview, so nothing was written. */
  readonly importWasPreview: boolean
  readonly lastSetup: KontextOntologySetupResult | null
  /** Ontology nodes with what the knowledge graph files under each; null until loaded. */
  readonly nodes: readonly KontextOntologyNodeMembers[] | null
  /** Live build progress while setup runs; null otherwise. */
  readonly progress: KontextOntologyProgress | null
  readonly lastSearch: KontextKnowledgeSearchResult | null
  readonly busy: OntologyAction | null
  readonly error: string | null
  /** Which action the error belongs to, so it can be shown beside that step's controls. */
  readonly errorAction: OntologyAction | null
  readonly notice: string | null
}

export const EMPTY_ONTOLOGY_STATE: OntologyState = {
  sources: null,
  checks: null,
  lastImport: null,
  importWasPreview: false,
  lastSetup: null,
  nodes: null,
  progress: null,
  lastSearch: null,
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
