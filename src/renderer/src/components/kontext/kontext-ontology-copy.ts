import { translate } from '@/i18n/i18n'

export function getKontextOntologyCopy() {
  return {
    title: translate('kondex.ontology.title', 'Ontology sources'),
    intro: translate(
      'kondex.ontology.intro',
      'Connect the places your decisions already live, then build the ontology from them. Each step below shows what is there before it changes anything.'
    ),

    stepWorkspace: translate('kondex.ontology.stepWorkspace', 'Choose a workspace'),
    stepSources: translate('kondex.ontology.stepSources', 'Connect sources'),
    stepCheck: translate('kondex.ontology.stepCheck', 'Check they answer'),
    stepBuild: translate('kondex.ontology.stepBuild', 'Build the ontology'),

    workspace: translate('kondex.ontology.workspace', 'Workspace holding kontext.yaml'),
    workspacePlaceholder: translate('kondex.ontology.workspacePlaceholder', 'Select a workspace'),
    noWorkspaces: translate(
      'kondex.ontology.noWorkspaces',
      'No workspaces yet. Add a project first.'
    ),

    noSources: translate(
      'kondex.ontology.noSources',
      'No sources connected yet. Import the ones you already use, or add one directly.'
    ),
    importPreviewAction: translate('kondex.ontology.importPreviewAction', 'Preview import'),
    importAction: translate('kondex.ontology.importAction', 'Import from Claude / Codex'),
    importNothingNew: translate(
      'kondex.ontology.importNothingNew',
      'Nothing new to import; every server found is already connected.'
    ),
    importWouldAdd: translate('kondex.ontology.importWouldAdd', 'Would add:'),
    refreshAction: translate('kondex.ontology.refreshAction', 'Refresh'),
    includeMarkdown: translate(
      'kondex.ontology.includeMarkdown',
      "Also use this workspace's own Markdown"
    ),
    importSummary: (added: number, found: number): string =>
      translate('kondex.ontology.importSummary', 'Found {{found}}, added {{added}}.', {
        added,
        found
      }),

    addAction: translate('kondex.ontology.addAction', 'Add a source'),
    addIntro: translate(
      'kondex.ontology.addIntro',
      'Pick a provider to fill in its transport and layer, then paste the address it gave you.'
    ),
    addConfirm: translate('kondex.ontology.addConfirm', 'Add'),
    cancel: translate('kondex.ontology.cancel', 'Cancel'),
    sourceName: translate('kondex.ontology.sourceName', 'Name'),
    transport: translate('kondex.ontology.transport', 'Transport'),
    command: translate('kondex.ontology.command', 'Command that starts the server'),
    url: translate('kondex.ontology.url', 'Server URL'),
    path: translate('kondex.ontology.path', 'Directory to read'),
    commandArgs: translate('kondex.ontology.commandArgs', 'Arguments, one per line'),
    commandArgsHint: translate(
      'kondex.ontology.commandArgsHint',
      'The server is started without a shell, so each argument goes on its own line.'
    ),
    presetGithubRepo: translate('kondex.ontology.presetGithubRepo', 'GitHub repository'),
    presetGithubMcp: translate('kondex.ontology.presetGithubMcp', 'GitHub MCP server'),
    repositoryUrl: translate('kondex.ontology.repositoryUrl', 'Repository URL'),
    repositoryUrlHint: translate(
      'kondex.ontology.repositoryUrlHint',
      'Paste the address you would give git clone. Private repositories work as far as your own git sign-in does; no token is stored here.'
    ),
    ref: translate('kondex.ontology.ref', 'Branch or tag (optional)'),
    presetGithubOrg: translate('kondex.ontology.presetGithubOrg', 'GitHub organization'),
    owner: translate('kondex.ontology.owner', 'Organization or user URL'),
    ownerHint: translate(
      'kondex.ontology.ownerHint',
      'Paste https://github.com/<org> or just the name. Repositories are listed through your gh login, so private ones appear as far as that login can see; nothing is stored here.'
    ),
    listRepositories: translate('kondex.ontology.listRepositories', 'Load repositories'),
    repositoriesFound: (count: number, owner: string): string =>
      translate('kondex.ontology.repositoriesFound', '{{count}} repositories in {{owner}}.', {
        count,
        owner
      }),
    noRepositories: translate('kondex.ontology.noRepositories', 'No repositories to list.'),
    includeArchived: translate('kondex.ontology.includeArchived', 'Include archived'),
    includeForks: translate('kondex.ontology.includeForks', 'Include forks'),
    selectAll: translate('kondex.ontology.selectAll', 'Select all'),
    selectNone: translate('kondex.ontology.selectNone', 'Clear selection'),
    addSelected: (count: number): string =>
      translate('kondex.ontology.addSelected', 'Add {{count}} selected', { count }),
    repositoryPrivate: translate('kondex.ontology.repositoryPrivate', 'private'),
    repositoryArchived: translate('kondex.ontology.repositoryArchived', 'archived'),
    repositoryFork: translate('kondex.ontology.repositoryFork', 'fork'),
    addProgress: (done: number, total: number): string =>
      translate('kondex.ontology.addProgress', 'Added {{done}} of {{total}}.', { done, total }),
    addFailed: (names: string): string =>
      translate('kondex.ontology.addFailed', 'Could not add: {{names}}', { names }),
    readCode: translate('kondex.ontology.readCode', 'Also read source code'),
    readCodeHint: translate(
      'kondex.ontology.readCodeHint',
      'Each directory of TypeScript, JavaScript or Python becomes one module document, described by what it exports, and is placed on ontology nodes beside the documents that govern it. Tests and generated files are skipped.'
    ),
    codeBadge: translate('kondex.ontology.codeBadge', 'code'),
    presetMcpServer: translate('kondex.ontology.presetMcpServer', 'Any MCP server'),
    presetMcpRemote: translate('kondex.ontology.presetMcpRemote', 'Remote MCP (HTTP)'),
    headers: translate('kondex.ontology.headers', 'Request headers, KEY=VALUE per line'),
    headersHint: translate(
      'kondex.ontology.headersHint',
      'For a hosted server: Authorization=Bearer ${NOTION_TOKEN}. A ${NAME} value is read from your environment when the server is called, so the token itself is not written to kontext.yaml.'
    ),
    toolsCount: (count: number): string =>
      translate('kondex.ontology.toolsCount', '{{count}} tools', { count }),
    mapAction: translate('kondex.ontology.mapAction', 'Map documents…'),
    mapIntro: translate(
      'kondex.ontology.mapIntro',
      'This server exposes tools rather than resources. Choose the tool that lists documents and the tool that reads one; paths point into their JSON results, like items or data.pages.'
    ),
    inspectAction: translate('kondex.ontology.inspectAction', 'Look at the server'),
    inspectSummary: (resources: number, tools: number): string =>
      translate('kondex.ontology.inspectSummary', '{{resources}} resources, {{tools}} tools', {
        resources,
        tools
      }),
    listTool: translate('kondex.ontology.listTool', 'Tool that lists documents'),
    listArguments: translate(
      'kondex.ontology.listArguments',
      'Fixed arguments for it (JSON, optional)'
    ),
    itemsPath: translate(
      'kondex.ontology.itemsPath',
      'Path to the array of items (empty if the result is the array)'
    ),
    idPath: translate('kondex.ontology.idPath', 'Path to the id inside an item'),
    titlePath: translate('kondex.ontology.titlePath', 'Path to the title (optional)'),
    readTool: translate('kondex.ontology.readTool', 'Tool that reads one document'),
    idArgument: translate('kondex.ontology.idArgument', 'Argument that receives the id'),
    contentPath: translate(
      'kondex.ontology.contentPath',
      'Path to the text (empty to use the tool text)'
    ),
    saveMapping: translate('kondex.ontology.saveMapping', 'Save mapping'),
    embeddingTitle: translate('kondex.ontology.embeddingTitle', 'Search embedding'),
    embeddingUnknown: translate('kondex.ontology.embeddingUnknown', 'not read yet'),
    embeddingIntro: translate(
      'kondex.ontology.embeddingIntro',
      'Vectors let a question find a passage worded differently. The built-in model runs inside Kondex and downloads once (about 120 MB); Ollama or an API can replace it, or vectors can be turned off.'
    ),
    embeddingChange: translate('kondex.ontology.embeddingChange', 'Change\u2026'),
    embedNow: translate('kondex.ontology.embedNow', 'Embed now'),
    embeddingProvider: translate('kondex.ontology.embeddingProvider', 'Provider'),
    providerBuiltin: translate('kondex.ontology.providerBuiltin', 'Built-in model (no install)'),
    providerOllama: translate('kondex.ontology.providerOllama', 'Ollama (local server)'),
    providerOpenai: translate('kondex.ontology.providerOpenai', 'OpenAI-compatible API'),
    providerNone: translate('kondex.ontology.providerNone', 'Off (word matching only)'),
    embeddingModel: translate(
      'kondex.ontology.embeddingModel',
      'Model (leave empty for the default)'
    ),
    embeddingBaseUrl: translate(
      'kondex.ontology.embeddingBaseUrl',
      'Server address (leave empty for the default)'
    ),
    embeddingApiKeyEnv: translate(
      'kondex.ontology.embeddingApiKeyEnv',
      'Environment variable holding the API key'
    ),
    embeddingHintBuiltin: translate(
      'kondex.ontology.embeddingHintBuiltin',
      'multilingual-e5-small runs on WebAssembly inside Kondex. Slower than a native runtime, but nothing to install and no data leaves the machine.'
    ),
    embeddingHintOllama: translate(
      'kondex.ontology.embeddingHintOllama',
      'Needs Ollama running with the model pulled (ollama pull nomic-embed-text). Faster and better than the built-in model on most machines.'
    ),
    embeddingHintOpenai: translate(
      'kondex.ontology.embeddingHintOpenai',
      'The key is read from the named environment variable when Kondex calls the API; it is never written to kontext.yaml. Any OpenAI-compatible endpoint works through the server address.'
    ),
    embeddingHintNone: translate(
      'kondex.ontology.embeddingHintNone',
      'Search matches words only. A question phrased differently from the document will miss it.'
    ),
    embeddingSave: translate('kondex.ontology.embeddingSave', 'Save embedding'),
    progressEmbed: (done: number, total: number): string =>
      translate('kondex.ontology.progressEmbed', 'Embedding chunks {{done}}/{{total}}', {
        done,
        total
      }),
    progressDownload: (done: number, total: number): string =>
      translate(
        'kondex.ontology.progressDownload',
        'Downloading the embedding model {{done}}/{{total}} MB',
        {
          done,
          total
        }
      ),
    setupEmbedded: (count: number): string =>
      translate('kondex.ontology.setupEmbedded', '{{count}} chunks embedded', { count }),
    setupEmbeddingFailed: (error: string): string =>
      translate(
        'kondex.ontology.setupEmbeddingFailed',
        'embedding failed, search stays word-based: {{error}}',
        {
          error
        }
      ),
    searchModeHybrid: translate('kondex.ontology.searchModeHybrid', 'words + meaning'),
    searchModeLexical: translate('kondex.ontology.searchModeLexical', 'words only'),
    rebuildAction: translate('kondex.ontology.rebuildAction', 'Reclassify and save'),
    progressCollect: (done: number): string =>
      translate('kondex.ontology.progressCollect', 'Collecting documents… {{done}}', { done }),
    progressDiscover: (done: number, total: number): string =>
      translate(
        'kondex.ontology.progressDiscover',
        'Discovering topics: batch {{done}} of {{total}}',
        {
          done,
          total
        }
      ),
    progressDesign: translate('kondex.ontology.progressDesign', 'Designing nodes…'),
    progressClassify: (done: number, total: number): string =>
      translate(
        'kondex.ontology.progressClassify',
        'Classifying documents: batch {{done}} of {{total}}',
        { done, total }
      ),
    progressSync: (done: number, total: number): string =>
      translate(
        'kondex.ontology.progressSync',
        'Writing knowledge: {{done}} of {{total}} documents',
        {
          done,
          total
        }
      ),
    progressCode: (done: number, total: number, source: string): string =>
      translate(
        'kondex.ontology.progressCode',
        'Projecting code symbols: {{done}} of {{total}} files ({{source}})',
        { done, total, source }
      ),
    stepNodes: translate('kondex.ontology.stepNodes', 'Read what each node holds'),
    loadNodes: translate('kondex.ontology.loadNodes', 'Show nodes and their documents'),
    nodeDocuments: (count: number): string =>
      translate('kondex.ontology.nodeDocuments', '{{count}} documents', { count }),
    nodeDocumentsUnknown: translate(
      'kondex.ontology.nodeDocumentsUnknown',
      'membership unknown (no knowledge store)'
    ),
    stepSearch: translate('kondex.ontology.stepSearch', 'Ask the knowledge graph'),
    searchQuestion: translate('kondex.ontology.searchQuestion', 'Question'),
    searchAction: translate('kondex.ontology.searchAction', 'Search'),
    searchHint: translate(
      'kondex.ontology.searchHint',
      'Answers come from the connected documents and code with an Evidence id per hit. Workers get the same search as the kontext_search_knowledge tool.'
    ),
    searchSummary: (hits: number, chunks: number, resources: number): string =>
      translate(
        'kondex.ontology.searchSummary',
        '{{hits}} hits over {{chunks}} chunks in {{resources}} documents.',
        { hits, chunks, resources }
      ),
    searchNoHits: translate(
      'kondex.ontology.searchNoHits',
      'Nothing matched. Build the ontology first, or ask with words from the documents.'
    ),
    env: translate('kondex.ontology.env', 'Environment for the server, KEY=VALUE per line'),
    envHint: translate(
      'kondex.ontology.envHint',
      'Tokens such as GITHUB_PERSONAL_ACCESS_TOKEN go here; they are written to kontext.yaml.'
    ),
    layerType: translate('kondex.ontology.layerType', 'Layer'),
    layerTypeNone: translate('kondex.ontology.layerTypeNone', 'Default'),

    checkAction: translate('kondex.ontology.checkAction', 'Check connections'),
    checkAllOk: translate('kondex.ontology.checkAllOk', 'Every source answered.'),
    checkSomeFailed: translate(
      'kondex.ontology.checkSomeFailed',
      'Some sources did not answer. Building now would leave their documents out.'
    ),
    checkFailed: translate('kondex.ontology.checkFailed', 'Did not answer'),
    resourceCount: (count: number): string =>
      translate('kondex.ontology.resourceCount', '{{count}} documents', { count }),

    targetNodes: translate('kondex.ontology.targetNodes', 'Node count (optional)'),
    previewAction: translate('kondex.ontology.previewAction', 'Preview'),
    buildAction: translate('kondex.ontology.buildAction', 'Build and save'),
    setupSummary: (nodes: number, written: boolean): string =>
      written
        ? translate('kondex.ontology.setupSaved', 'Saved {{nodes}} nodes.', { nodes })
        : translate('kondex.ontology.setupPreviewed', '{{nodes}} nodes ready, not saved.', {
            nodes
          }),

    busy: translate('kondex.ontology.busy', 'Running…'),
    invalidTargetNodes: translate(
      'kondex.ontology.invalidTargetNodes',
      'Node count must be a whole number between 3 and 200, or left empty.'
    ),
    scope: translate(
      'kondex.ontology.scope',
      'Building sends collected document titles to the model configured in kontext.yaml. It starts no agent and approves no decision.'
    )
  }
}
