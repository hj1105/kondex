import { beforeEach, describe, expect, it, vi } from 'vitest'

const ipcState = vi.hoisted(() => ({
  handleHandlers: new Map<string, (event: unknown, ...args: unknown[]) => unknown>()
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (event: unknown, ...args: unknown[]) => unknown) => {
      ipcState.handleHandlers.set(channel, handler)
    }
  }
}))

import { registerRateLimitHandlers } from './rate-limits'
import type { RateLimitService } from '../rate-limits/service'
import type { RateLimitRuntimeTarget, RateLimitState } from '../../shared/rate-limit-types'
import type { CodexAccountService } from '../codex-accounts/service'

function makeCodexAccounts() {
  const consumeCurrentRateLimitResetCredit = vi.fn(() =>
    Promise.resolve({ outcome: 'noCredit', state: {} as RateLimitState })
  )
  return {
    service: { consumeCurrentRateLimitResetCredit } as unknown as CodexAccountService,
    consumeCurrentRateLimitResetCredit
  }
}

function makeService(): {
  service: RateLimitService
  refresh: ReturnType<typeof vi.fn>
  refreshCodexForTarget: ReturnType<typeof vi.fn>
  refreshClaudeForTarget: ReturnType<typeof vi.fn>
  consumeCodexRateLimitResetCredit: ReturnType<typeof vi.fn>
} {
  const refresh = vi.fn(() => Promise.resolve({} as RateLimitState))
  const refreshCodexForTarget = vi.fn(() => Promise.resolve({} as RateLimitState))
  const refreshClaudeForTarget = vi.fn(() => Promise.resolve({} as RateLimitState))
  const consumeCodexRateLimitResetCredit = vi.fn(() =>
    Promise.resolve({ outcome: 'noCredit', state: {} as RateLimitState })
  )
  const service = {
    getState: vi.fn(() => ({}) as RateLimitState),
    refresh,
    refreshCodexForTarget,
    refreshClaudeForTarget,
    consumeCodexRateLimitResetCredit,
    setPollingInterval: vi.fn(() => Promise.resolve()),
    fetchInactiveClaudeAccountsOnOpen: vi.fn(() => Promise.resolve()),
    fetchInactiveCodexAccountsOnOpen: vi.fn(() => Promise.resolve())
  }
  return {
    service: service as unknown as RateLimitService,
    refresh,
    refreshCodexForTarget,
    refreshClaudeForTarget,
    consumeCodexRateLimitResetCredit
  }
}

describe('registerRateLimitHandlers', () => {
  beforeEach(() => {
    ipcState.handleHandlers.clear()
  })

  it('registers the aggregate refresh channel that delegates to refresh()', async () => {
    const { service, refresh } = makeService()
    registerRateLimitHandlers(service, makeCodexAccounts().service)
    const handler = ipcState.handleHandlers.get('rateLimits:refresh')
    expect(handler).toBeDefined()
    await handler!({})
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('registers supported rate-limit channels without retired providers', () => {
    const { service } = makeService()
    registerRateLimitHandlers(service, makeCodexAccounts().service)
    expect(ipcState.handleHandlers.has('rateLimits:get')).toBe(true)
    expect(ipcState.handleHandlers.has('rateLimits:refresh')).toBe(true)
    expect(ipcState.handleHandlers.has('rateLimits:refreshCodexForTarget')).toBe(true)
    expect(ipcState.handleHandlers.has('rateLimits:refreshClaudeForTarget')).toBe(true)
    expect(ipcState.handleHandlers.has('rateLimits:refreshMiniMax')).toBe(false)
    expect(ipcState.handleHandlers.has('rateLimits:refreshGrok')).toBe(false)
  })

  it.each(['Codex', 'Claude'] as const)(
    'forwards the execution target to the %s refresh channel',
    async (agent) => {
      const mocks = makeService()
      registerRateLimitHandlers(mocks.service, makeCodexAccounts().service)
      const handler = ipcState.handleHandlers.get(`rateLimits:refresh${agent}ForTarget`)
      const target: RateLimitRuntimeTarget = { runtime: 'wsl', wslDistro: 'Ubuntu' }

      expect(handler).toBeDefined()
      await handler!({}, target)

      expect(mocks[`refresh${agent}ForTarget`]).toHaveBeenCalledExactlyOnceWith(target)
      expect(mocks.refresh).not.toHaveBeenCalled()
    }
  )

  it('serializes desktop reset consumption through CodexAccountService', async () => {
    const { service, consumeCodexRateLimitResetCredit } = makeService()
    const codexAccounts = makeCodexAccounts()
    registerRateLimitHandlers(service, codexAccounts.service)
    const handler = ipcState.handleHandlers.get('rateLimits:consumeCodexResetCredit')

    await handler!({})

    expect(codexAccounts.consumeCurrentRateLimitResetCredit).toHaveBeenCalledOnce()
    expect(consumeCodexRateLimitResetCredit).not.toHaveBeenCalled()
  })
})
