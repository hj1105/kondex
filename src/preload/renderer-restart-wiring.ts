import type { IpcRenderer } from 'electron'
import { ORCA_RENDERER_UNLOAD_PREVENTED_EVENT } from '../shared/renderer-shutdown-events'
import { prepareRendererForAppRestart } from '../shared/renderer-restart-preparation'
import {
  ORCA_APP_RESTART_ABORTED_EVENT,
  ORCA_APP_RESTART_STARTED_EVENT
} from '../shared/app-restart-events'

export function registerRendererRestartIpcRelays(
  ipcRenderer: Pick<IpcRenderer, 'on'>,
  eventTarget: EventTarget
): void {
  ipcRenderer.on('window:unload-prevented', () => {
    eventTarget.dispatchEvent(new Event(ORCA_RENDERER_UNLOAD_PREVENTED_EVENT))
    eventTarget.dispatchEvent(new Event(ORCA_APP_RESTART_ABORTED_EVENT))
  })
}

export async function prepareAndInvokeAppRestart(
  eventTarget: EventTarget,
  invoke: () => Promise<unknown>,
  awaitCheckpoint: () => Promise<void>
): Promise<void> {
  await prepareRendererForAppRestart(eventTarget, {
    startedEventName: ORCA_APP_RESTART_STARTED_EVENT,
    abortedEventName: ORCA_APP_RESTART_ABORTED_EVENT,
    awaitCheckpoint
  })
  try {
    await invoke()
  } catch (error) {
    eventTarget.dispatchEvent(new Event(ORCA_APP_RESTART_ABORTED_EVENT))
    throw error
  }
}
