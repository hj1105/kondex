import { dialog, type BrowserWindow, type MessageBoxOptions } from 'electron'

import { translateMain } from '../i18n/main-i18n'

export type RuntimeRpcStartErrorClass =
  | 'permission_denied'
  | 'address_in_use'
  | 'storage_unavailable'
  | 'invalid_path'
  | 'unknown'

const MAX_VISIBLE_CAUSE_LENGTH = 500

const ERROR_CLASS_BY_CODE: Readonly<Record<string, RuntimeRpcStartErrorClass>> = {
  EACCES: 'permission_denied',
  EPERM: 'permission_denied',
  EADDRINUSE: 'address_in_use',
  EDQUOT: 'storage_unavailable',
  EIO: 'storage_unavailable',
  ENOSPC: 'storage_unavailable',
  EROFS: 'storage_unavailable',
  EINVAL: 'invalid_path',
  ENAMETOOLONG: 'invalid_path',
  ENOENT: 'invalid_path',
  ENOTDIR: 'invalid_path'
}

function getErrorCode(error: unknown, seen = new Set<object>()): string | null {
  if (typeof error !== 'object' || error === null || seen.has(error)) {
    return null
  }
  seen.add(error)
  // Why: only a mapped code ends the walk — an unmapped wrapper code would otherwise mask a nested EACCES/ENOSPC.
  const code = 'code' in error ? error.code : undefined
  if (typeof code === 'string') {
    const normalizedCode = code.toUpperCase()
    if (ERROR_CLASS_BY_CODE[normalizedCode]) {
      return normalizedCode
    }
  }
  return 'cause' in error ? getErrorCode(error.cause, seen) : null
}

export function classifyRuntimeRpcStartFailure(error: unknown): RuntimeRpcStartErrorClass {
  const code = getErrorCode(error)
  return (code && ERROR_CLASS_BY_CODE[code]) || 'unknown'
}

function describeRuntimeRpcStartFailure(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : translateMain(
            'runtimeRpc.startupFailure.unknownCause',
            'No additional error details were available.'
          )
  const normalized =
    raw.trim() ||
    translateMain(
      'runtimeRpc.startupFailure.unknownCause',
      'No additional error details were available.'
    )
  return normalized.length <= MAX_VISIBLE_CAUSE_LENGTH
    ? normalized
    : `${normalized.slice(0, MAX_VISIBLE_CAUSE_LENGTH - 1)}…`
}

// Why: a bare "restart" is wrong for every class but address_in_use — perms, full disks and missing
// dirs all survive a relaunch, so each class names the thing the user actually has to change.
const GUIDANCE_BY_ERROR_CLASS: Readonly<
  Record<RuntimeRpcStartErrorClass, { key: string; fallback: string }>
> = {
  permission_denied: {
    key: 'runtimeRpc.startupFailure.guidance.permissionDenied',
    fallback:
      "Kondex couldn't write its runtime file. Check permissions on Kondex's data folder, then restart."
  },
  storage_unavailable: {
    key: 'runtimeRpc.startupFailure.guidance.storageUnavailable',
    fallback: 'Your disk may be full or read-only. Free up space, then restart Kondex.'
  },
  invalid_path: {
    key: 'runtimeRpc.startupFailure.guidance.invalidPath',
    fallback:
      "Kondex's data folder may be missing, moved, or at a path that is too long. Restore it or use a shorter path, then restart Kondex."
  },
  address_in_use: {
    key: 'runtimeRpc.startupFailure.guidance.addressInUse',
    fallback: 'Another process may be holding the port. Restart Kondex to try again.'
  },
  unknown: {
    key: 'runtimeRpc.startupFailure.guidance.unknown',
    fallback: 'Restart Kondex to try again.'
  }
}

function createRuntimeRpcStartupFailureDialogOptions(error: unknown): MessageBoxOptions {
  const cause = describeRuntimeRpcStartFailure(error)
  const { key, fallback } = GUIDANCE_BY_ERROR_CLASS[classifyRuntimeRpcStartFailure(error)]
  return {
    type: 'error',
    buttons: [translateMain('runtimeRpc.startupFailure.continueButton', 'Continue without CLI')],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
    title: translateMain('runtimeRpc.startupFailure.title', 'Kondex CLI unavailable'),
    message: translateMain(
      'runtimeRpc.startupFailure.message',
      "Kondex couldn't start its local command transport."
    ),
    detail: translateMain(
      'runtimeRpc.startupFailure.detail',
      'Kondex will continue to work, but commands such as kondex status, kondex terminal, and orchestration are unavailable for this session.\n\n{{guidance}}\n\nCause: {{cause}}',
      { cause, guidance: translateMain(key, fallback) }
    )
  }
}

export function recordRuntimeRpcStartFailure(error: unknown): void {
  console.error('[runtime] Failed to start local RPC transport:', error)
}

function waitForWindowToShow(parentWindow: BrowserWindow): Promise<boolean> {
  if (parentWindow.isDestroyed()) {
    return Promise.resolve(false)
  }
  const parentWebContents = parentWindow.webContents
  if (parentWebContents.isDestroyed()) {
    return Promise.resolve(false)
  }
  if (parentWindow.isVisible()) {
    return Promise.resolve(true)
  }
  return new Promise((resolve) => {
    const settle = (visible: boolean): void => {
      parentWindow.removeListener('show', onShow)
      parentWebContents.removeListener('destroyed', onDestroyed)
      resolve(visible)
    }
    const onShow = (): void =>
      settle(!parentWindow.isDestroyed() && !parentWebContents.isDestroyed())
    const onDestroyed = (): void => settle(false)
    parentWindow.once('show', onShow)
    // Why: keep this failure-only waiter off the crowded BrowserWindow `closed` event.
    parentWebContents.once('destroyed', onDestroyed)
  })
}

export async function showRuntimeRpcStartupFailureDialog(
  parentWindow: BrowserWindow,
  error: unknown
): Promise<void> {
  if (!(await waitForWindowToShow(parentWindow))) {
    return
  }
  try {
    await dialog.showMessageBox(parentWindow, createRuntimeRpcStartupFailureDialogOptions(error))
  } catch (dialogError) {
    console.error('[runtime] Failed to show RPC startup failure dialog:', dialogError)
  }
}
