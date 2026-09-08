import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { renderKondexIcon } from './render-kondex-icons.mjs'
import { buildWindowsIcoFromPng, decodePng } from './trim-windows-icon-source.mjs'

const resources = join(dirname(dirname(import.meta.dirname)), 'resources')

describe('shipped Kondex icons', () => {
  it.each([
    ['icon.png', 256, {}],
    ['icon-dev.png', 256, { dev: true }],
    ['build/icon.png', 1024, {}],
    ['tray/kondex-menu-barTemplate.png', 18, { template: true }],
    ['tray/kondex-menu-barTemplate@2x.png', 36, { template: true }]
  ])('%s matches the canonical K vector', async (name, size, options) => {
    const source = await readFile(join(resources, 'logo.svg'), 'utf8')
    const expected = decodePng(await renderKondexIcon(source, size, options))
    const actual = decodePng(await readFile(join(resources, name)))
    expect(actual.width).toBe(size)
    expect(actual.height).toBe(size)
    expect(actual.data.equals(expected.data)).toBe(true)
    expect(actual.data[3]).toBe(0)
    expect(actual.data.some((value, index) => index % 4 === 3 && value > 0)).toBe(true)
  })

  it('packages the same mark in the Windows icon', async () => {
    const source = await readFile(join(resources, 'build/icon.png'))
    const actual = await readFile(join(resources, 'build/icon.ico'))
    expect(actual.equals(buildWindowsIcoFromPng(source))).toBe(true)
  })

  it('packages the canonical full-size mark in the macOS icon', async () => {
    const archive = await readFile(join(resources, 'build/icon.icns'))
    expect(archive.toString('ascii', 0, 4)).toBe('icns')
    expect(archive.readUInt32BE(4)).toBe(archive.length)
    let master = null
    for (let offset = 8; offset < archive.length;) {
      const length = archive.readUInt32BE(offset + 4)
      expect(length).toBeGreaterThanOrEqual(8)
      expect(offset + length).toBeLessThanOrEqual(archive.length)
      if (archive.toString('ascii', offset, offset + 4) === 'ic10') {
        master = decodePng(archive.subarray(offset + 8, offset + length))
      }
      offset += length
    }
    expect(master?.width).toBe(1024)
    expect(master?.height).toBe(1024)
    const source = decodePng(await readFile(join(resources, 'build/icon.png')))
    expect(master?.data.equals(source.data)).toBe(true)
  })
})
