import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { buildWindowsIcoFromPng } from './trim-windows-icon-source.mjs'

const projectDir = dirname(dirname(import.meta.dirname))

/** Rasterize the canonical vector mark; no fonts or external image sources. */
export async function renderKondexIcon(svg, size, { template = false, dev = false } = {}) {
  const canvas = createCanvas(size, size)
  const context = canvas.getContext('2d')
  if (!template) {
    const gradient = context.createLinearGradient(0, 0, 0, size)
    gradient.addColorStop(0, dev ? '#666' : '#333')
    gradient.addColorStop(1, dev ? '#333' : '#080808')
    context.fillStyle = gradient
    context.beginPath()
    context.roundRect(size * 0.08, size * 0.08, size * 0.84, size * 0.84, size * 0.19)
    context.fill()
  }
  const source = (template ? svg.replaceAll('#fff', '#000') : svg).replace(
    '<svg ',
    `<svg width="${size}" height="${size}" `
  )
  const mark = await loadImage(Buffer.from(source))
  const inset = template ? 0 : size * 0.16
  context.drawImage(mark, inset, inset, size - inset * 2, size - inset * 2)
  return canvas.encode('png')
}

export async function generateKondexIcons(iconsetDir) {
  const resourcesDir = join(projectDir, 'resources')
  const buildDir = join(resourcesDir, 'build')
  const svg = await readFile(join(resourcesDir, 'logo.svg'), 'utf8')
  await mkdir(iconsetDir, { recursive: true })
  const master = await renderKondexIcon(svg, 1024)
  await writeFile(join(buildDir, 'icon.png'), master)
  await writeFile(join(buildDir, 'icon.ico'), buildWindowsIcoFromPng(master))
  await writeFile(join(resourcesDir, 'icon.png'), await renderKondexIcon(svg, 256))
  await writeFile(
    join(resourcesDir, 'icon-dev.png'),
    await renderKondexIcon(svg, 256, { dev: true })
  )
  for (const [scale, size] of [
    [1, 18],
    [2, 36]
  ]) {
    const suffix = scale === 1 ? '' : '@2x'
    await writeFile(
      join(resourcesDir, 'tray', `kondex-menu-barTemplate${suffix}.png`),
      await renderKondexIcon(svg, size, { template: true })
    )
  }
  for (const size of [16, 32, 128, 256, 512]) {
    for (const scale of [1, 2]) {
      const suffix = scale === 1 ? '' : '@2x'
      await writeFile(
        join(iconsetDir, `icon_${size}x${size}${suffix}.png`),
        await renderKondexIcon(svg, size * scale)
      )
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const iconsetDir = process.argv[2]
  if (!iconsetDir?.endsWith('.iconset')) {
    throw new Error('Pass the temporary .iconset directory created by build:icons.')
  }
  await generateKondexIcons(iconsetDir)
}
