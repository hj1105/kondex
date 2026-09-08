import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { KONTEXT_HOST_MANAGEMENT_TOOL_NAMES, KONTEXT_TOOL_NAMES } from './kontext-sidecar-service'

/**
 * Packaging verifies the bundled sidecar against a JSON list, because the build
 * script cannot import this TypeScript. This keeps the two from drifting.
 */
describe('packaged sidecar tool contract', () => {
  it('matches the tools Kondex calls without a host management token', () => {
    const manifest = JSON.parse(
      readFileSync(join(process.cwd(), 'config', 'kontext-required-sidecar-tools.json'), 'utf8')
    ) as { tools: string[] }
    const hostManaged = new Set<string>(KONTEXT_HOST_MANAGEMENT_TOOL_NAMES)
    expect(manifest.tools).toEqual(KONTEXT_TOOL_NAMES.filter((name) => !hostManaged.has(name)))
  })
})
