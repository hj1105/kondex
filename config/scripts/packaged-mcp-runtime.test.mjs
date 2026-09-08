import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const {
  createPackagedRuntimeNodeModuleResources,
  verifyPackagedMainRuntimeDeps
} = require('../packaged-runtime-node-modules.cjs')
const sdk = JSON.parse(
  readFileSync(
    new URL('../../node_modules/@modelcontextprotocol/sdk/package.json', import.meta.url),
    'utf8'
  )
)

async function withPackagedMain(source, check) {
  const root = await mkdtemp(join(tmpdir(), 'kondex-packaged-mcp-'))
  try {
    await writeFile(join(root, 'app.asar'), '')
    const files = new Map([
      ['out/main/index.js', source],
      ['out/main/agent-hooks/managed-agent-hook-controls.js', '']
    ])
    const asar = {
      listPackage: () => [...files.keys()],
      extractFile: (_archive, file) => Buffer.from(files.get(file))
    }
    await check(root, asar)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

describe('packaged Kontext MCP dependency', () => {
  it.each(['darwin', 'linux', 'win32'])('ships the SDK and its dependencies on %s', (platform) => {
    const targets = new Set(
      createPackagedRuntimeNodeModuleResources(platform).map((entry) => entry.to)
    )
    for (const name of [sdk.name, ...Object.keys(sdk.dependencies)]) {
      expect(targets.has(join('node_modules', ...name.split('/'))), name).toBe(true)
    }
  })

  it.each(["'", '"', '`'])('detects missing static requires quoted with %s', async (quote) => {
    await withPackagedMain(
      `const client = require(${quote}@modelcontextprotocol/sdk/client/index.js${quote});`,
      async (root, asar) => {
        expect(() => verifyPackagedMainRuntimeDeps(root, asar)).toThrow('@modelcontextprotocol/sdk')
        await mkdir(join(root, 'node_modules', '@modelcontextprotocol', 'sdk'), { recursive: true })
        expect(() => verifyPackagedMainRuntimeDeps(root, asar)).not.toThrow()
      }
    )
  })

  it('does not treat comments or displayed code as runtime imports', async () => {
    await withPackagedMain(
      [
        '// require("comment-only")',
        'const example = `require("display-only")`;',
        'const fs = require(`node:fs`);'
      ].join('\n'),
      (root, asar) => {
        expect(() => verifyPackagedMainRuntimeDeps(root, asar)).not.toThrow()
      }
    )
  })
})
