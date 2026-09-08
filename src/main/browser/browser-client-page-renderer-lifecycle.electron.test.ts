import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { build as buildVite } from 'vite'
import { runBrowserRouteEgressElectron } from './browser-route-egress-electron-launch'
import {
  bundledEgressProbeTestBudgetMs,
  EGRESS_PROBE_INNER_WAIT_MS,
  EGRESS_PROBE_SELF_EXIT_MS
} from './browser-route-egress-probe-budgets'

const fixtureRoots: string[] = []

type FixtureResult = {
  deniedError: string
  deniedWebviewCount: number
  destroyed: boolean
  hostRendererMatched: boolean
  initialUrl: string
  mountedWebContentsId: number
  retiredWebviewCount: number
}

afterAll(() => {
  for (const root of fixtureRoots) {
    rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  }
})

async function buildFixtureBundle(options: {
  entry: string
  fileName: string
  format: 'cjs' | 'iife'
  root: string
  target: string
  external?: string[]
}): Promise<void> {
  await buildVite({
    configFile: false,
    logLevel: 'silent',
    build: {
      emptyOutDir: false,
      lib: {
        entry: options.entry,
        formats: [options.format],
        fileName: () => options.fileName,
        name: 'OrcaBrowserClientPageFixture'
      },
      outDir: options.root,
      target: options.target,
      rollupOptions: { external: options.external ?? [] }
    }
  })
}

function preloadEntry(requestsPath: string): string {
  return `
import { contextBridge, ipcRenderer } from 'electron'
import { createBrowserClientPageRendererRequests } from ${JSON.stringify(requestsPath)}

const requests = createBrowserClientPageRendererRequests({
  ipc: ipcRenderer,
  isTopFrame: () => window.top === window,
  timeoutMs: 8000
})
contextBridge.exposeInMainWorld('browserClientPageFixture', {
  subscribe: requests.subscribe
})
`
}

function rendererEntry(installationPath: string): string {
  return `
import { installBrowserClientPageRenderer } from ${JSON.stringify(installationPath)}

const fixture = window.browserClientPageFixture
window.__browserClientPageFixtureInstallation = installBrowserClientPageRenderer({
  document,
  subscribe: fixture.subscribe
})
window.__browserClientPageFixtureReady = true
`
}

function fixtureMain(options: {
  bridgePath: string
  htmlPath: string
  preloadPath: string
  resultPath: string
}): string {
  return `
const { app, BrowserWindow, ipcMain } = require('electron')
const { writeFileSync } = require('node:fs')
const { BrowserClientPageRendererBridgeRegistry } = require(${JSON.stringify(options.bridgePath)})

const resultPath = ${JSON.stringify(options.resultPath)}
const preparedPartition = 'persist:browser-client-page-prepared'
const transport = {
  onReply: (listener) => ipcMain.on('browser:clientPageRendererReply', listener),
  offReply: (listener) => ipcMain.removeListener('browser:clientPageRendererReply', listener)
}

async function waitForRendererReady(contents) {
  const deadline = Date.now() + ${EGRESS_PROBE_INNER_WAIT_MS}
  while (Date.now() < deadline) {
    if (await contents.executeJavaScript('window.__browserClientPageFixtureReady === true')) return
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new Error('renderer fixture did not become ready')
}

async function waitForGuestUrl(guest) {
  const deadline = Date.now() + ${EGRESS_PROBE_INNER_WAIT_MS}
  while (Date.now() < deadline) {
    const url = guest.getURL()
    if (url) return url
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new Error('attached guest URL did not become observable')
}

async function run() {
  const timeout = setTimeout(() => {
    writeFileSync(resultPath, JSON.stringify({ error: 'fixture timeout' }))
    app.exit(2)
  }, ${EGRESS_PROBE_SELF_EXIT_MS})
  await app.whenReady()
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: ${JSON.stringify(options.preloadPath)},
      sandbox: false,
      webviewTag: true
    }
  })
  let attachedGuest = null
  let destroyed = false
  window.webContents.on('will-attach-webview', (event, webPreferences, params) => {
    const partition = typeof webPreferences.partition === 'string' ? webPreferences.partition : ''
    if (partition !== preparedPartition || params.src !== 'about:blank') {
      event.preventDefault()
      return
    }
    delete params.preload
    webPreferences.nodeIntegration = false
    webPreferences.contextIsolation = true
    webPreferences.sandbox = true
    webPreferences.partition = partition
  })
  window.webContents.on('did-attach-webview', (_event, guest) => {
    attachedGuest = guest
    guest.setWindowOpenHandler(() => ({ action: 'deny' }))
    guest.on('will-navigate', (event, url) => {
      if (url !== 'about:blank') event.preventDefault()
    })
    guest.once('destroyed', () => {
      destroyed = true
    })
  })
  await window.loadFile(${JSON.stringify(options.htmlPath)})
  await waitForRendererReady(window.webContents)

  const bridges = new BrowserClientPageRendererBridgeRegistry({
    transport,
    timeoutMs: 12000
  })
  const renderer = bridges.attachRenderer(window.webContents)
  const page = {
    partition: preparedPartition,
    browserPageId: 'page-a',
    pageHostGeneration: 7
  }
  const mounted = await renderer.mountPage(page, new AbortController().signal)
  if (!attachedGuest) throw new Error('did-attach-webview was not observed')
  const initialUrl = await waitForGuestUrl(attachedGuest)
  const hostRendererMatched = attachedGuest.hostWebContents === window.webContents
  if (attachedGuest.id !== mounted.webContentsId) throw new Error('guest id mismatch')

  await renderer.retirePage(page)
  const destructionDeadline = Date.now() + ${EGRESS_PROBE_INNER_WAIT_MS}
  while (!destroyed && Date.now() < destructionDeadline) {
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  const retiredWebviewCount = await window.webContents.executeJavaScript(
    "document.querySelectorAll('webview').length"
  )

  let deniedError = ''
  try {
    await renderer.mountPage({ ...page, partition: 'persist:unprepared', pageHostGeneration: 8 }, new AbortController().signal)
  } catch (error) {
    deniedError = String(error && error.message ? error.message : error)
  }
  const deniedWebviewCount = await window.webContents.executeJavaScript(
    "document.querySelectorAll('webview').length"
  )

  bridges.dispose()
  clearTimeout(timeout)
  writeFileSync(resultPath, JSON.stringify({
    deniedError,
    deniedWebviewCount,
    destroyed,
    hostRendererMatched,
    initialUrl,
    mountedWebContentsId: mounted.webContentsId,
    retiredWebviewCount
  }))
  window.destroy()
  app.exit(0)
}

run().catch((error) => {
  writeFileSync(resultPath, JSON.stringify({ error: String(error && error.stack ? error.stack : error) }))
  app.exit(1)
})
`
}

async function runFixture(): Promise<FixtureResult> {
  const root = mkdtempSync(join(tmpdir(), 'orca-client-page-renderer-'))
  fixtureRoots.push(root)
  const preloadSource = join(root, 'preload-entry.ts')
  const rendererSource = join(root, 'renderer-entry.ts')
  const htmlPath = join(root, 'index.html')
  const mainPath = join(root, 'main.cjs')
  const resultPath = join(root, 'result.json')
  writeFileSync(
    preloadSource,
    preloadEntry(join(process.cwd(), 'src/preload/browser-client-page-renderer-requests.ts'))
  )
  writeFileSync(
    rendererSource,
    rendererEntry(
      join(
        process.cwd(),
        'src/renderer/src/components/browser-pane/browser-client-page-renderer-installation.ts'
      )
    )
  )
  writeFileSync(htmlPath, '<!doctype html><body><script src="./renderer.js"></script></body>')
  await Promise.all([
    buildFixtureBundle({
      entry: join(process.cwd(), 'src/main/browser/browser-client-page-renderer-bridge.ts'),
      fileName: 'bridge.cjs',
      format: 'cjs',
      root,
      target: 'node20',
      external: ['electron', 'node:crypto']
    }),
    buildFixtureBundle({
      entry: preloadSource,
      fileName: 'preload.cjs',
      format: 'cjs',
      root,
      target: 'node20',
      external: ['electron']
    }),
    buildFixtureBundle({
      entry: rendererSource,
      fileName: 'renderer.js',
      format: 'iife',
      root,
      target: 'chrome136'
    })
  ])
  writeFileSync(
    mainPath,
    fixtureMain({
      bridgePath: join(root, 'bridge.cjs'),
      htmlPath,
      preloadPath: join(root, 'preload.cjs'),
      resultPath
    })
  )

  return (await runBrowserRouteEgressElectron(root, mainPath)) as FixtureResult
}

describe('browser client page renderer lifecycle under Electron', () => {
  it(
    'settles exact main-frame mounts and retires the attached guest',
    async () => {
      const result = await runFixture()

      expect(result.mountedWebContentsId).toBeGreaterThan(0)
      expect(result.hostRendererMatched).toBe(true)
      expect(['about:blank', 'data:text/html,']).toContain(result.initialUrl)
      expect(result.destroyed).toBe(true)
      expect(result.retiredWebviewCount).toBe(0)
      expect(result.deniedError).toBe('browser_client_page_renderer_guest_destroyed')
      expect(result.deniedWebviewCount).toBe(0)
    },
    bundledEgressProbeTestBudgetMs(1)
  )
})
