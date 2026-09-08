import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { execFileSync } = vi.hoisted(() => ({ execFileSync: vi.fn() }))
vi.mock('node:child_process', () => ({ execFileSync }))

const platformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform')
const archDescriptor = Object.getOwnPropertyDescriptor(process, 'arch')
const originalArgv = process.argv
let outputDir
let compiled

beforeEach(() => {
  vi.resetModules()
  execFileSync.mockReset()
  outputDir = mkdtempSync(path.join(tmpdir(), 'kondex-notification-test-'))
  compiled = []
  Object.defineProperty(process, 'platform', { ...platformDescriptor, value: 'darwin' })
  execFileSync.mockImplementation((command, args) => {
    if (command !== 'swiftc') {
      return
    }
    const plistPath = args.at(-1)
    compiled.push({ args, plistPath, plist: readFileSync(plistPath, 'utf8') })
  })
})

afterEach(() => {
  process.argv = originalArgv
  Object.defineProperty(process, 'platform', platformDescriptor)
  Object.defineProperty(process, 'arch', archDescriptor)
  rmSync(outputDir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

async function build(args = []) {
  const output = path.join(outputDir, 'orca-notification-status')
  process.argv = [
    process.execPath,
    'build-notification-status-macos.mjs',
    '--output',
    output,
    ...args
  ]
  await import('./build-notification-status-macos.mjs')
  return output
}

describe('notification helper packaging identity', () => {
  it('embeds the Kondex app identity in both release architectures', async () => {
    const output = await build()

    expect(compiled).toHaveLength(2)
    expect(compiled.map(({ args }) => args[args.indexOf('-target') + 1])).toEqual([
      'arm64-apple-macosx11.0',
      'x86_64-apple-macosx11.0'
    ])
    for (const { plist, plistPath } of compiled) {
      expect(plist).toMatch(
        /<key>CFBundleIdentifier<\/key>\s*<string>app\.kondex\.desktop<\/string>/
      )
      expect(plist).toContain('<string>orca-notification-status</string>')
      expect(existsSync(path.dirname(plistPath))).toBe(false)
    }
    expect(execFileSync).toHaveBeenCalledWith('lipo', [
      '-create',
      ...compiled.map(({ args }) => args[args.indexOf('-o') + 1]),
      '-output',
      output
    ])
    expect(execFileSync).toHaveBeenCalledWith('chmod', ['755', output])
  })

  it.each([
    ['arm64', 'arm64-apple-macosx11.0'],
    ['x64', 'x86_64-apple-macosx11.0']
  ])('preserves the explicit development identity on %s', async (arch, target) => {
    Object.defineProperty(process, 'arch', { ...archDescriptor, value: arch })
    const output = await build(['--single-arch', '--bundle-id', 'app.kondex.desktop.dev'])

    expect(compiled).toHaveLength(1)
    expect(compiled[0].plist).toContain('<string>app.kondex.desktop.dev</string>')
    expect(compiled[0].args).toContain(target)
    expect(execFileSync).toHaveBeenCalledWith('cp', [
      compiled[0].args[compiled[0].args.indexOf('-o') + 1],
      output
    ])
    expect(execFileSync.mock.calls.some(([command]) => command === 'lipo')).toBe(false)
    expect(existsSync(path.dirname(compiled[0].plistPath))).toBe(false)
  })

  it('cleans temporary compiler inputs after a build failure', async () => {
    let plistPath
    execFileSync.mockImplementation((command, args) => {
      if (command === 'swiftc') {
        plistPath = args.at(-1)
        throw new Error('compiler failed')
      }
    })

    await expect(build()).rejects.toThrow('compiler failed')
    expect(plistPath).toBeDefined()
    expect(existsSync(path.dirname(plistPath))).toBe(false)
    expect(execFileSync.mock.calls.some(([command]) => command === 'chmod')).toBe(false)
  })
})
