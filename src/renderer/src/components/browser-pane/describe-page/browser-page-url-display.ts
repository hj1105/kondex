import type { BrowserPage as BrowserPageState } from '../../../../../shared/browser-workspace-types'
import { ORCA_BROWSER_BLANK_URL } from '../../../../../shared/constants'
import {
  normalizeBrowserNavigationUrl,
  normalizeExternalBrowserUrl,
  redactKagiSessionToken
} from '../../../../../shared/browser-url'
import type { BrowserTabPageState } from './browser-page-types'

function browserFileUrlToAbsolutePath(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'file:') {
      return null
    }
    const hostPrefix =
      parsed.hostname && parsed.hostname !== 'localhost' ? `//${parsed.hostname}` : ''
    let absolutePath = `${hostPrefix}${decodeURIComponent(parsed.pathname)}`
    if (/^\/[A-Za-z]:\//.test(absolutePath)) {
      absolutePath = absolutePath.slice(1)
    }
    if (/^[A-Za-z]:\//.test(absolutePath) || absolutePath.startsWith('//')) {
      absolutePath = absolutePath.replaceAll('/', '\\')
    }
    return absolutePath
  } catch {
    return null
  }
}

export function getBrowserPageRuntimeEnvironmentId(
  page: BrowserPageState,
  inferredRuntimeEnvironmentId: string | null | undefined
): string | null {
  if (page.browserRuntimeEnvironmentId !== undefined) {
    return page.browserRuntimeEnvironmentId?.trim() || null
  }
  return inferredRuntimeEnvironmentId?.trim() || null
}

export function toDisplayUrl(url: string): string {
  return url === ORCA_BROWSER_BLANK_URL ? 'about:blank' : redactKagiSessionToken(url)
}

export function getBrowserDisplayTitle(title: string | null | undefined, url: string): string {
  if (
    url === 'about:blank' ||
    url === ORCA_BROWSER_BLANK_URL ||
    title === 'about:blank' ||
    title === ORCA_BROWSER_BLANK_URL ||
    !title
  ) {
    return 'New Tab'
  }
  return title
}

export function isChromiumErrorPage(url: string): boolean {
  return url.startsWith('chrome-error://')
}

export function getNotebookPathFromBrowserUrl(url: string): string | null {
  const filePath = browserFileUrlToAbsolutePath(url)
  return filePath?.toLowerCase().endsWith('.ipynb') ? filePath : null
}

export function getOpenableExternalUrl(currentUrl: string): string | null {
  return normalizeExternalBrowserUrl(redactKagiSessionToken(currentUrl))
}

export function retryBrowserTabLoad(
  webview: Electron.WebviewTag | null,
  browserTab: BrowserPageState,
  onUpdatePageState: (tabId: string, updates: BrowserTabPageState) => void
): void {
  if (!webview) {
    return
  }

  const retryUrl = normalizeBrowserNavigationUrl(
    browserTab.loadError?.validatedUrl ?? browserTab.url
  )
  if (!retryUrl) {
    return
  }

  // Why: after chrome-error://, reload() only refreshes the error page — force navigation back to the attempted URL; keep the failure visible until success.
  onUpdatePageState(browserTab.id, {
    loading: true,
    title: retryUrl
  })
  webview.src = retryUrl
}
