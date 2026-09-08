import {
  ORCA_EDITOR_PREPARE_HOT_EXIT_EVENT,
  type EditorPrepareHotExitDetail
} from './editor-save-events'
import {
  consumeShutdownCheckpointFailureReason,
  ORCA_RENDERER_SHUTDOWN_CHECKPOINT_ABORTED_EVENT,
  ORCA_RENDERER_SHUTDOWN_CHECKPOINT_FAILED_EVENT
} from './renderer-shutdown-events'

export type AppRestartPrepOptions = {
  startedEventName: string
  abortedEventName: string
  /** Joins the durable write of the state the checkpoint staged; rejects if it failed. */
  awaitCheckpoint: () => Promise<void>
}

function requestEditorHotExitBackup(eventTarget: EventTarget): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let claimed = false
    eventTarget.dispatchEvent(
      new CustomEvent<EditorPrepareHotExitDetail>(ORCA_EDITOR_PREPARE_HOT_EXIT_EVENT, {
        detail: {
          claim: () => {
            claimed = true
          },
          resolve,
          reject: (message) => {
            reject(new Error(message))
          }
        }
      })
    )

    // Why: restart paths can run before the editor autosave controller mounts.
    // With no claimant, there are no renderer-owned dirty buffers to back up.
    if (!claimed) {
      resolve()
    }
  })
}

export async function prepareRendererForAppRestart(
  eventTarget: EventTarget,
  { startedEventName, abortedEventName, awaitCheckpoint }: AppRestartPrepOptions
): Promise<void> {
  eventTarget.dispatchEvent(new Event(startedEventName))
  let checkpointFailed = false

  try {
    await requestEditorHotExitBackup(eventTarget)
    const markCheckpointFailed = (): void => {
      checkpointFailed = true
    }
    eventTarget.addEventListener(
      ORCA_RENDERER_SHUTDOWN_CHECKPOINT_FAILED_EVENT,
      markCheckpointFailed
    )
    try {
      // Why: the aggregate unload verdict also includes unrelated listeners.
      eventTarget.dispatchEvent(new Event('beforeunload', { cancelable: true }))
    } finally {
      eventTarget.removeEventListener(
        ORCA_RENDERER_SHUTDOWN_CHECKPOINT_FAILED_EVENT,
        markCheckpointFailed
      )
    }
    if (checkpointFailed) {
      // Why: the guard publishes the swallowed persist error out-of-band so the
      // initiating restart surface can report what actually failed.
      const reason = consumeShutdownCheckpointFailureReason()
      throw new Error(
        reason
          ? `Renderer shutdown checkpoint was not completed: ${reason}`
          : 'Renderer shutdown checkpoint was not completed.'
      )
    }
    // Why: the checkpoint only stages synchronously. Navigating before that
    // write lands loses the session snapshot to a crash or power loss.
    await awaitCheckpoint()
  } catch (error) {
    // A checkpoint failure ends the current restart without abandoning the
    // retry-then-degrade budget that the next user attempt must consume.
    eventTarget.dispatchEvent(
      new Event(
        checkpointFailed ? ORCA_RENDERER_SHUTDOWN_CHECKPOINT_ABORTED_EVENT : abortedEventName
      )
    )
    throw error
  }
}
