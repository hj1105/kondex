import { afterEach, describe, expect, it, vi } from 'vitest'
import { SKILLS_INSTALLED_HANDLERS } from './skills-installed'

const successMeta = { runtimeId: 'runtime-1' }

function context(call: ReturnType<typeof vi.fn>, options: { json?: boolean } = {}) {
  return {
    client: { call, isRemote: false },
    cwd: '/repo',
    flags: new Map<string, string | boolean>(),
    json: options.json ?? false
  } as never
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('installed skills CLI handler', () => {
  it('lists safe installed-skill selectors without local paths', async () => {
    const call = vi.fn().mockResolvedValue({
      id: 'request-1',
      ok: true,
      result: {
        skills: [
          {
            id: 'skill-id',
            name: 'alpha',
            description: 'Alpha skill',
            providers: ['codex'],
            sourceKind: 'home',
            sourceLabel: 'Codex',
            rootPath: '/secret/root',
            directoryPath: '/secret/root/alpha',
            skillFilePath: '/secret/root/alpha/SKILL.md',
            installed: true,
            updatedAt: null
          }
        ],
        sources: [],
        scannedAt: 1
      },
      _meta: successMeta
    })
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    await SKILLS_INSTALLED_HANDLERS['skills installed']!(context(call, { json: true }))

    expect(call).toHaveBeenCalledWith('skills.discover', { cwd: '/repo' })
    const output = String(log.mock.calls[0][0])
    expect(output).toContain('skill-id')
    expect(output).not.toContain('/secret/root')
  })
})
