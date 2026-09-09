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
      'TypeScript, JavaScript and Python files are described by their exported symbols and placed on ontology nodes beside the documents that govern them. Tests and generated files are skipped.'
    ),
    codeBadge: translate('kondex.ontology.codeBadge', 'code'),
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
