import { describe, expect, it } from 'vitest'
import {
  resolveOuterWrapperForegroundIdentity,
  resolveOuterWrapperForegroundProcess
} from './foreground-wrapper-agent'

describe('resolveOuterWrapperForegroundProcess', () => {
  const claude = { agent: 'claude' as const, processName: 'claude' }

  it('leaves a cross-group agent (codex) untouched even under a deeper same-name child', () => {
    const codex = { agent: 'codex' as const, processName: 'codex' }
    expect(
      resolveOuterWrapperForegroundProcess(
        codex,
        { pid: 102, ppid: 101, command: 'node /usr/bin/codex' },
        [
          { pid: 102, ppid: 101, command: 'node /usr/bin/codex' },
          { pid: 101, ppid: 100, command: 'bash -l' }
        ]
      )
    ).toBe('codex')
  })

  it('does not treat an unrelated shallower codex sibling as the claude wrapper', () => {
    expect(
      resolveOuterWrapperForegroundProcess(claude, { pid: 103, ppid: 102, command: 'claude' }, [
        { pid: 101, ppid: 100, command: 'codex' },
        { pid: 102, ppid: 100, command: 'node server.js' },
        { pid: 103, ppid: 102, command: 'claude' }
      ])
    ).toBe('claude')
  })

  it('keeps the winner pid when nothing collapses', () => {
    const bareClaude = { pid: 101, ppid: 100, command: 'claude' }
    expect(resolveOuterWrapperForegroundIdentity(claude, bareClaude, [bareClaude])).toEqual({
      processName: 'claude',
      processId: 101
    })
  })
})
