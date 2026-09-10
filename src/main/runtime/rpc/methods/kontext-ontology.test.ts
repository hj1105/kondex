import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OrcaRuntimeService } from '../../orca-runtime'
import { RpcDispatcher } from '../dispatcher'
import { KONTEXT_METHODS } from './kontext'

const mocks = vi.hoisted(() => ({ run: vi.fn(), resolve: vi.fn() }))
vi.mock('../../../kontext/kontext-ontology-cli', () => ({
  runKontextOntologyJson: mocks.run
}))
vi.mock('../../../../shared/app-environment', () => ({
  getAppEnvironment: () => ({ getPath: () => '/host/userData' })
}))

const workspace = { workspacePath: 'id:folder:one' }

function call(method: string, params: unknown, signal?: AbortSignal) {
  return new RpcDispatcher({
    runtime: {
      getRuntimeId: () => 'fixture-host',
      resolveKontextSourceWorkspace: mocks.resolve
    } as unknown as OrcaRuntimeService,
    methods: KONTEXT_METHODS
  }).dispatch({ id: 'fixture', authToken: 'fixture', method, params }, { signal })
}

const argsOf = (index = 0): string[] => mocks.run.mock.calls[index]?.[0].args

beforeEach(() => {
  mocks.resolve.mockReset().mockResolvedValue('/host/workspace')
  mocks.run.mockReset()
})

describe('Kontext ontology RPC', () => {
  it('resolves the owning workspace before running anything', async () => {
    mocks.run.mockResolvedValue({ command: 'list', ok: true, sources: [] })
    await call('kontext.listOntologySources', workspace)
    expect(mocks.resolve).toHaveBeenCalledWith('id:folder:one')
    expect(mocks.run).toHaveBeenCalledWith(
      expect.objectContaining({ args: ['list'], workspacePath: '/host/workspace' })
    )
  })

  it('returns per-source state so a surface can render it', async () => {
    mocks.run.mockResolvedValue({
      command: 'list',
      ok: true,
      sources: [{ name: 'repo-docs', transport: 'local', type: null, target: '/repo' }]
    })
    const response = await call('kontext.listOntologySources', workspace)
    expect(response).toMatchObject({
      result: { sources: [{ name: 'repo-docs', transport: 'local', target: '/repo' }] }
    })
  })

  it('reports a checked failure as a result, not as a crash', async () => {
    mocks.run.mockResolvedValue({
      command: 'check',
      ok: false,
      sources: [
        { name: 'docs', ok: true, resourceCount: 2, error: null },
        { name: 'slack', ok: false, resourceCount: null, error: 'refused' }
      ]
    })
    const response = await call('kontext.checkOntologySources', workspace)
    expect(response).toMatchObject({
      ok: true,
      result: {
        ok: false,
        sources: [
          { name: 'docs', ok: true, resourceCount: 2 },
          { name: 'slack', ok: false, error: 'refused' }
        ]
      }
    })
  })

  it('surfaces a command-level failure with the message the CLI gave', async () => {
    mocks.run.mockResolvedValue({ command: 'add', ok: false, error: "A source named 'x' exists." })
    const response = await call('kontext.addOntologySource', {
      ...workspace,
      name: 'x',
      transport: 'local',
      path: '/repo'
    })
    expect(response).toMatchObject({ ok: false })
    expect(JSON.stringify(response)).toContain("A source named 'x' exists.")
  })

  it('writes nothing unless the caller asks it to', async () => {
    mocks.run.mockResolvedValue({
      command: 'import-mcp',
      ok: true,
      discovered: [],
      added: [],
      written: false
    })
    await call('kontext.importOntologySources', {
      ...workspace,
      includeMarkdown: false,
      apply: false
    })
    expect(argsOf()).toEqual(['import-mcp', '--project', '.'])

    mocks.run.mockResolvedValue({
      command: 'setup',
      ok: true,
      nodesCreated: 0,
      nodesReused: 0,
      documentsClassified: 0,
      documentsUnmapped: 0,
      nodeIds: [],
      written: false
    })
    await call('kontext.setupOntology', { ...workspace, apply: false })
    expect(argsOf(1)).toEqual(['setup', '--data-dir', '/host/userData/kontext'])
  })

  it("passes the caller's choices through as command flags", async () => {
    mocks.run.mockResolvedValue({
      command: 'import-mcp',
      ok: true,
      discovered: [],
      added: [],
      written: true
    })
    await call('kontext.importOntologySources', {
      ...workspace,
      includeMarkdown: true,
      apply: true
    })
    expect(argsOf()).toEqual(['import-mcp', '--project', '.', '--markdown', '.', '--write'])

    mocks.run.mockResolvedValue({ command: 'add', ok: true, name: 'notion', written: true })
    await call('kontext.addOntologySource', {
      ...workspace,
      name: 'notion',
      transport: 'sse',
      url: 'https://mcp.notion.invalid',
      type: 'notion',
      apply: true
    })
    expect(argsOf(1)).toEqual([
      'add',
      '--name',
      'notion',
      '--transport',
      'sse',
      '--url',
      'https://mcp.notion.invalid',
      '--type',
      'notion',
      '--write'
    ])
  })

  it('passes a repository URL, its ref, and one --env per variable', async () => {
    mocks.run.mockResolvedValue({ command: 'add', ok: true, name: 'handbook', written: true })
    await call('kontext.addOntologySource', {
      ...workspace,
      name: 'handbook',
      transport: 'git',
      url: 'https://github.com/org/handbook.git',
      ref: 'release',
      apply: true
    })
    expect(argsOf()).toEqual([
      'add',
      '--name',
      'handbook',
      '--transport',
      'git',
      '--url',
      'https://github.com/org/handbook.git',
      '--ref',
      'release',
      '--write'
    ])

    mocks.run.mockResolvedValue({ command: 'add', ok: true, name: 'github', written: false })
    await call('kontext.addOntologySource', {
      ...workspace,
      name: 'github',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      // Why: a value with '=' must survive; the CLI splits on the first one only.
      env: { GITHUB_PERSONAL_ACCESS_TOKEN: 'ghp_x', GITHUB_API_URL: 'https://ghe.invalid/api?v=3' }
    })
    expect(argsOf(1)).toEqual([
      'add',
      '--name',
      'github',
      '--transport',
      'stdio',
      '--command',
      'npx',
      '--arg',
      '-y',
      '--arg',
      '@modelcontextprotocol/server-github',
      '--env',
      'GITHUB_PERSONAL_ACCESS_TOKEN=ghp_x',
      '--env',
      'GITHUB_API_URL=https://ghe.invalid/api?v=3'
    ])
  })

  it('asks for code as one flag and lists an owner through the CLI', async () => {
    mocks.run.mockResolvedValue({ command: 'add', ok: true, name: 'handbook', written: true })
    await call('kontext.addOntologySource', {
      ...workspace,
      name: 'handbook',
      transport: 'git',
      url: 'https://github.com/org/handbook.git',
      code: true,
      apply: true
    })
    expect(argsOf()).toEqual([
      'add',
      '--name',
      'handbook',
      '--transport',
      'git',
      '--url',
      'https://github.com/org/handbook.git',
      '--code',
      '--write'
    ])

    const repository = {
      name: 'handbook',
      fullName: 'org/handbook',
      url: 'https://github.com/org/handbook',
      cloneUrl: 'https://github.com/org/handbook.git',
      defaultBranch: 'main',
      private: true,
      archived: false,
      fork: false,
      language: 'TypeScript',
      description: null,
      pushedAt: '2026-09-01T00:00:00Z'
    }
    mocks.run.mockResolvedValue({
      command: 'github-repos',
      ok: true,
      owner: 'org',
      kind: 'organization',
      repositories: [repository]
    })
    const response = await call('kontext.listGithubRepositories', {
      ...workspace,
      owner: 'https://github.com/org'
    })
    expect(argsOf(1)).toEqual(['github-repos', '--owner', 'https://github.com/org'])
    expect(response).toMatchObject({
      result: { owner: 'org', kind: 'organization', repositories: [repository] }
    })
  })

  it('searches the knowledge graph in the sidecar data directory with the given filters', async () => {
    const hit = {
      evidenceId: 'r1|source|c1',
      resourceId: 'r1',
      chunkId: 'c1',
      title: 'Billing decisions',
      source: { connectorId: 'handbook', externalId: 'docs/billing.md', type: 'local' },
      ontologyNodeIds: ['Billing'],
      text: 'Failed payments retry twice.',
      score: 2.2,
      matchedTerms: ['retry']
    }
    mocks.run.mockResolvedValue({
      command: 'query',
      ok: true,
      dataDirectory: '/host/userData/kontext',
      hits: [hit],
      resourcesScanned: 3,
      chunksScanned: 4
    })
    const response = await call('kontext.searchKnowledge', {
      ...workspace,
      question: 'how do payments retry',
      limit: 5,
      ontologyNodeIds: ['Billing', 'Payments']
    })
    expect(argsOf()).toEqual([
      'query',
      '--data-dir',
      '/host/userData/kontext',
      '--question',
      'how do payments retry',
      '--limit',
      '5',
      '--node',
      'Billing',
      '--node',
      'Payments'
    ])
    expect(response).toMatchObject({ result: { hits: [hit], chunksScanned: 4 } })
  })

  it('refuses a git source without a repository URL before spawning anything', async () => {
    const response = await call('kontext.addOntologySource', {
      ...workspace,
      name: 'handbook',
      transport: 'git'
    })
    expect(response).toMatchObject({ ok: false })
    expect(mocks.run).not.toHaveBeenCalled()
  })

  it('passes each stdio argument separately so a comma cannot split one', async () => {
    mocks.run.mockResolvedValue({ command: 'add', ok: true, name: 'gh', written: true })
    await call('kontext.addOntologySource', {
      ...workspace,
      name: 'gh',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github', '--header=A: 1,2'],
      apply: true
    })
    expect(argsOf()).toEqual([
      'add',
      '--name',
      'gh',
      '--transport',
      'stdio',
      '--command',
      'npx',
      '--arg',
      '-y',
      '--arg',
      '@modelcontextprotocol/server-github',
      '--arg',
      '--header=A: 1,2',
      '--write'
    ])
  })

  it('refuses an add whose address does not match its transport', async () => {
    // The form could catch this, but the RPC must not spawn a process to find out.
    const response = await call('kontext.addOntologySource', {
      ...workspace,
      name: 'notion',
      transport: 'sse',
      path: '/repo'
    })
    expect(response).toMatchObject({ ok: false })
    expect(mocks.run).not.toHaveBeenCalled()
  })

  it("refuses a node count outside the builder's accepted range", async () => {
    for (const targetNodeCount of [2, 500]) {
      const response = await call('kontext.setupOntology', { ...workspace, targetNodeCount })
      expect(response).toMatchObject({ ok: false })
    }
    expect(mocks.run).not.toHaveBeenCalled()
  })

  it('does not run a command for an already aborted request', async () => {
    const controller = new AbortController()
    controller.abort()
    const response = await call('kontext.listOntologySources', workspace, controller.signal)
    expect(response).toMatchObject({ ok: false })
    expect(mocks.run).not.toHaveBeenCalled()
  })
})
