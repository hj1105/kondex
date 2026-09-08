import type { ElectronApplication } from '@stablyai/playwright-test'
import { afterEach, describe, expect, it } from 'vitest'
import { setTerminalPtyWriteDelay } from './helpers/terminal-pty-write-spy'

const delayGlobal = globalThis as typeof globalThis & { __terminalPtyWriteDelayMs?: number }
const original = Object.getOwnPropertyDescriptor(globalThis, '__terminalPtyWriteDelayMs')

afterEach(() => {
  if (original) {
    Object.defineProperty(globalThis, '__terminalPtyWriteDelayMs', original)
  } else {
    Reflect.deleteProperty(globalThis, '__terminalPtyWriteDelayMs')
  }
})

describe('terminal write delay main-process arguments', () => {
  it.each([120, 0, -20])(
    'sets %i ms from the payload, not the Electron module',
    async (delayMs) => {
      const app = {
        evaluate: async (callback: (electron: object, payload: number) => void, payload: number) =>
          callback({ ipcMain: {} }, payload)
      } as unknown as ElectronApplication

      await setTerminalPtyWriteDelay(app, delayMs)

      expect(delayGlobal.__terminalPtyWriteDelayMs).toBe(Math.max(0, delayMs))
    }
  )
})
