import { beforeEach, expect, it, vi } from 'vitest'
import {
  registeredIntegrationFixture as empty,
  savedIntegrationFixture as saved
} from '../../../../shared/__fixtures__/kontext-registered-integration'
import type { OrcaRuntimeService } from '../../orca-runtime'
import { RpcDispatcher } from '../dispatcher'
import { kontextRegisteredScheduleMethods } from './kontext-registered-schedule'
const mocks = vi.hoisted(() => ({ callTool: vi.fn(), service: vi.fn() }))
vi.mock('../../../kontext/kontext-sidecar-runtime', () => ({
  getKontextSidecarService: mocks.service
}))
const selector = { taskId: empty.taskId, jobId: empty.jobId }
const request = {
  ...selector,
  expectedJobIdentityDigest: empty.jobIdentityDigest,
  expectedIntegrationDigest: null,
  allowSubscriptionExecution: true
}
function call(
  integrate = false,
  params: unknown = integrate ? request : selector,
  signal?: AbortSignal,
  legacy = false
) {
  return new RpcDispatcher({
    runtime: { getRuntimeId: () => 'owning-host' } as unknown as OrcaRuntimeService,
    methods: legacy ? [] : kontextRegisteredScheduleMethods
  }).dispatch(
    {
      id: 'test',
      authToken: 'fixture',
      method: integrate
        ? 'kontext.integrateRegisteredSchedule'
        : 'kontext.inspectRegisteredIntegration',
      params
    },
    { signal }
  )
}
beforeEach(() => {
  mocks.service.mockReset().mockReturnValue({ callTool: mocks.callTool })
  mocks.callTool.mockReset().mockResolvedValue(empty)
})
it('inspects only the owning host, strips untrusted fields and does not integrate', async () => {
  mocks.callTool.mockResolvedValue({
    ...saved,
    diagnostics: 'PRIVATE',
    integration: { ...saved.integration, prompt: 'PRIVATE' }
  })
  const result = await call(false, { ...selector, hostToken: 'forged', repositoryPath: '/client' })
  expect(result).toMatchObject({ ok: true, result: saved })
  expect(JSON.stringify(result)).not.toContain('PRIVATE')
  expect(mocks.callTool).toHaveBeenCalledExactlyOnceWith(
    'kontext_inspect_registered_integration',
    selector
  )
  expect(mocks.service).toHaveBeenCalledExactlyOnceWith('owning-host')
})
it('requires exact reviewed identity, nullable integration basis and explicit consent', async () => {
  for (const params of [
    selector,
    { ...request, allowSubscriptionExecution: false },
    { ...request, expectedIntegrationDigest: undefined }
  ]) {
    expect(await call(true, params)).toMatchObject({ ok: false })
  }
  expect(mocks.callTool).not.toHaveBeenCalled()
  mocks.callTool.mockResolvedValue({ ...saved, command: 'integrate' })
  expect(await call(true)).toMatchObject({ ok: true })
  expect(mocks.callTool).toHaveBeenCalledExactlyOnceWith(
    'kontext_integrate_registered_schedule',
    request
  )
})
it.each([
  { ...saved, taskId: 'wrong' },
  { ...saved, jobId: 'wrong' },
  { ...saved, integrationDigest: null },
  { ...empty, canRequestIntegration: true, scheduleStatus: 'interrupted' },
  { ...saved, integration: { ...saved.integration, taskId: 'wrong' } },
  { ...saved, currentEvidence: 'verified' },
  { ...saved, command: 'integrate' }
])('rejects contradictory or mismatched saved integration', async (response) => {
  mocks.callTool.mockResolvedValue(response)
  expect(await call()).toMatchObject({ ok: false })
})
it('requires command acknowledgement and the selected execution after mutation', async () => {
  for (const response of [
    saved,
    { ...saved, command: 'integrate', jobIdentityDigest: `sha256:${'e'.repeat(64)}` },
    {
      ...saved,
      command: 'integrate',
      integration: { ...saved.integration, scheduleJobId: 'different' }
    }
  ]) {
    mocks.callTool.mockResolvedValue(response)
    expect(await call(true)).toMatchObject({ ok: false })
  }
})
it('does not replay, fall back or accept a late aborted mutation result', async () => {
  expect(await call(false, selector, undefined, true)).toMatchObject({
    ok: false,
    error: { code: 'method_not_found' }
  })
  const before = new AbortController()
  before.abort()
  expect(await call(true, request, before.signal)).toMatchObject({ ok: false })
  expect(mocks.callTool).not.toHaveBeenCalled()
  const during = new AbortController()
  mocks.callTool.mockImplementationOnce(async () => {
    during.abort()
    return { ...saved, command: 'integrate' }
  })
  expect(await call(true, request, during.signal)).toMatchObject({ ok: false })
  mocks.callTool.mockRejectedValueOnce(new Error('lost response'))
  expect(await call(true)).toMatchObject({ ok: false })
  expect(mocks.callTool).toHaveBeenCalledTimes(2)
})
