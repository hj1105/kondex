import type * as FileSystem from 'node:fs/promises'
import { afterEach, expect, it, vi } from 'vitest'
import { probeAgentSessionReservation } from './agent-session-process-identity-probe'
import {
  findAgentSessionSpawnTokenProcesses,
  scanAgentSessionSpawnTokenEvidence,
  scanAgentSessionSpawnTokenProcesses
} from './agent-session-spawn-token-process-scan'
import { CODEX_SPAWN_TOKEN_ENV } from '../codex/codex-structured-owner-identity'
import {
  adjudicateAgentSessionRestart,
  evaluateAgentSessionAcquisition
} from '../../shared/agent-session-lease-adjudication'
import { agentSessionLeaseFixture } from '../../shared/agent-session-record.test-fixture'

const filesystem = vi.hoisted(() => ({
  list: vi.fn<() => Promise<string[]>>(),
  read: vi.fn<(path: string) => Promise<string>>()
}))

vi.mock('node:fs/promises', async (importOriginal) => ({
  ...(await importOriginal<typeof FileSystem>()),
  readdir: filesystem.list,
  readFile: filesystem.read
}))

afterEach(() => vi.resetAllMocks())

async function probe() {
  return probeAgentSessionReservation({
    spawnToken: 'reserved-token',
    findProcessesWithSpawnToken: (token) =>
      findAgentSessionSpawnTokenProcesses(token, () =>
        scanAgentSessionSpawnTokenProcesses('linux')
      ),
    hasProviderActivitySinceReservation: async () => false
  })
}

it.each(['EACCES', 'EPERM', 'EIO', 'ENOENT'])(
  'does not free a reservation when a process environment cannot be read: %s',
  async (code) => {
    filesystem.list.mockResolvedValue(['202'])
    filesystem.read.mockRejectedValue(Object.assign(new Error('fixture read failure'), { code }))
    const result = await probe()
    expect(result).toMatchObject({ outcome: 'indeterminate' })
    const lease = agentSessionLeaseFixture({
      runtimeKind: 'native',
      ownerProcess: null,
      claimStatus: 'reserved',
      reservedSpawnToken: 'reserved-token',
      provenHandleLinkId: null
    })
    expect(
      adjudicateAgentSessionRestart({ lease, probe: result, observedAt: 90_000 })
    ).toMatchObject({ disposition: 'recovering', stage: 'manual-recovery' })
    expect(
      evaluateAgentSessionAcquisition({
        lease,
        probe: result,
        expectedFence: lease.runtimeFence,
        handoffOperationId: null
      })
    ).toMatchObject({ decision: 'refused' })
  }
)

it('does not treat an empty visible process namespace as proof a child never spawned', async () => {
  filesystem.list.mockResolvedValue([])
  expect(await probe()).toMatchObject({ outcome: 'indeterminate' })
})

it('does not publish a partial scan as verified process evidence', async () => {
  filesystem.list.mockResolvedValue(['101', '202'])
  filesystem.read.mockImplementation(async (path) => {
    if (path === '/proc/101/environ') {
      return `${CODEX_SPAWN_TOKEN_ENV}=different-token\0`
    }
    throw Object.assign(new Error('fixture permission failure'), { code: 'EACCES' })
  })
  expect(await scanAgentSessionSpawnTokenProcesses('linux')).toBeNull()
  expect(await scanAgentSessionSpawnTokenEvidence('linux')).toEqual({
    status: 'unverifiable',
    processes: null,
    platform: 'linux'
  })
})

it('does not infer absence from a readable snapshot containing only other tokens', async () => {
  filesystem.list.mockResolvedValue(['101'])
  filesystem.read.mockResolvedValue(`${CODEX_SPAWN_TOKEN_ENV}=different-token\0`)
  expect(await probe()).toMatchObject({ outcome: 'indeterminate' })
})

it('keeps a reservation fenced when its token is positively observed', async () => {
  filesystem.list.mockResolvedValue(['202'])
  filesystem.read.mockResolvedValue(`${CODEX_SPAWN_TOKEN_ENV}=reserved-token\0`)
  expect(
    await findAgentSessionSpawnTokenProcesses('reserved-token', () =>
      scanAgentSessionSpawnTokenProcesses('linux')
    )
  ).toEqual([202])
  expect(await probe()).toMatchObject({ outcome: 'indeterminate' })
})

it('preserves an explicit host non-answer without checking provider activity', async () => {
  const activity = vi.fn(async () => false)
  expect(
    await probeAgentSessionReservation({
      spawnToken: 'reserved-token',
      findProcessesWithSpawnToken: async () => null,
      hasProviderActivitySinceReservation: activity
    })
  ).toMatchObject({ outcome: 'indeterminate' })
  expect(activity).not.toHaveBeenCalled()
})

it('keeps a failed directory enumeration unverifiable', async () => {
  filesystem.list.mockRejectedValue(new Error('fixture directory failure'))
  expect(await probe()).toMatchObject({ outcome: 'indeterminate' })
  expect(filesystem.read).not.toHaveBeenCalled()
})

it.each(['darwin', 'win32'] as const)('does not attempt proc reads on %s', async (platform) => {
  expect(await scanAgentSessionSpawnTokenEvidence(platform)).toEqual({
    status: 'unverifiable',
    processes: null,
    platform
  })
  expect(filesystem.list).not.toHaveBeenCalled()
  expect(filesystem.read).not.toHaveBeenCalled()
})

it('preserves multiple positive sightings and a configured token variable', async () => {
  filesystem.list.mockResolvedValue(['self', '101', '202'])
  filesystem.read.mockResolvedValue('FIXTURE_TOKEN=reserved-token\0')
  expect(
    await findAgentSessionSpawnTokenProcesses('reserved-token', () =>
      scanAgentSessionSpawnTokenProcesses('linux', 'FIXTURE_TOKEN')
    )
  ).toEqual([101, 202])
  expect(filesystem.read).toHaveBeenCalledTimes(2)
})
