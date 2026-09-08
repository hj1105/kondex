import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { createFinalizationFixture } from './kontext-finalization-fixture.mjs'
import { createRegisteredScheduleFixture } from './kontext-registered-schedule-fixture.mjs'
import { createRegisteredIntegrationFixture } from './kontext-registered-integration-fixture.mjs'

// Protocol-only fixture: never launches a CLI, reads credentials, or changes a repository.
const server = new Server(
  { name: 'kondex-workbench-fixture', version: '1' },
  { capabilities: { tools: {} } }
)
const taskId = 'task:e2e'
const codeRevision = 'revision:fixture'
const contextDigest = 'context:fixture'
const timestamp = '2026-09-06T00:00:00.000Z'
let job
let refreshCount = 0
let completionCount = 0
const hostToken = process.env.KONTEXT_HOST_MANAGEMENT_TOKEN
delete process.env.KONTEXT_HOST_MANAGEMENT_TOKEN
const finalization =
  process.env.KONDEX_E2E_FINALIZATION_FIXTURE === '1'
    ? createFinalizationFixture({ taskId, contextDigest, timestamp, hostToken })
    : null
const names = [
  'kontext_inspect_registered_schedule',
  'kontext_list_registered_schedules',
  'kontext_inspect_registered_integration',
  'kontext_integrate_registered_schedule',
  'kontext_resume_registered_schedule',
  'kontext_cancel_registered_schedule',
  'kontext_list_tasks',
  'kontext_finalize_task',
  'kontext_inspect_finalization',
  'kontext_revalidate_finalization',
  'kontext_assess_completion',
  'kontext_inspect_runtimes',
  'kontext_inspect_task',
  'kontext_schedule_logic',
  'kontext_get_schedule',
  'kontext_cancel_schedule',
  'kontext_integrate_schedule'
]
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: names.map((name) => ({ name, inputSchema: { type: 'object' } }))
}))
const registeredSchedule =
  process.env.KONDEX_E2E_REGISTERED_SCHEDULE_FIXTURE === '1'
    ? createRegisteredScheduleFixture({
        taskId,
        codeRevision,
        contextDigest,
        timestamp,
        hostToken,
        completedOlder: process.env.KONDEX_E2E_REGISTERED_INTEGRATION_FIXTURE === '1'
      })
    : null
const registeredIntegration =
  registeredSchedule && process.env.KONDEX_E2E_REGISTERED_INTEGRATION_FIXTURE === '1'
    ? createRegisteredIntegrationFixture(registeredSchedule)
    : null
if (registeredSchedule) {
  job = registeredSchedule.job
}
server.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
  const args = params.arguments ?? {}
  let result
  switch (params.name) {
    case 'kontext_inspect_registered_integration':
    case 'kontext_integrate_registered_schedule':
      if (!registeredIntegration) {
        throw new Error('Registered integration fixture is not enabled')
      }
      result = registeredIntegration.call(params)
      break
    case 'kontext_inspect_registered_schedule':
    case 'kontext_list_registered_schedules':
    case 'kontext_resume_registered_schedule':
    case 'kontext_cancel_registered_schedule':
      if (!registeredSchedule) {
        throw new Error('Registered schedule fixture is not enabled')
      }
      result = registeredSchedule.call(params)
      job = registeredSchedule.job
      break
    case 'kontext_list_tasks': {
      if (!hostToken || args.hostToken !== hostToken) {
        throw new Error('Fixture inventory authority mismatch')
      }
      const record = finalization?.call(
        { name: 'kontext_inspect_finalization', arguments: { taskId, hostToken } },
        job
      ).record
      result = {
        version: 1,
        organizationId: 'org:fixture',
        observation: 'saved_metadata_only',
        currentEvidence: 'not_revalidated',
        inventoryDigest: `sha256:${'a'.repeat(64)}`,
        nextCursor: null,
        tasks: [
          {
            taskId,
            intent: 'Verify the registered logic workflow',
            risk: 'low',
            workspaceId: 'folder:fixture',
            workspacePath: job?.repositoryPath ?? '/fixture/project',
            createdAt: timestamp,
            contextDigest,
            scheduleCount: registeredSchedule?.count ?? (job ? 1 : 0),
            unsettledScheduleCount:
              registeredSchedule?.count ??
              (job && !['completed', 'failed', 'cancelled'].includes(job.status) ? 1 : 0),
            latestSchedule: job
              ? {
                  taskId,
                  jobId: job.jobId,
                  status: job.status,
                  codeRevision,
                  contextDigest,
                  requestedAt: timestamp
                }
              : null,
            integration: record
              ? { jobId: record.request.jobId, gitCommit: record.gitCommit, createdAt: timestamp }
              : null,
            finalization: record
              ? {
                  recordId: record.recordId,
                  jobId: record.request.jobId,
                  gitCommit: record.gitCommit,
                  completedAt: timestamp
                }
              : null
          }
        ]
      }
      break
    }
    case 'kontext_finalize_task':
    case 'kontext_inspect_finalization':
    case 'kontext_revalidate_finalization':
      if (!finalization) {
        throw new Error('Finalization fixture is not enabled')
      }
      result = finalization.call(params, job)
      break
    case 'kontext_assess_completion':
      if (
        !hostToken ||
        args.hostToken !== hostToken ||
        args.taskId !== taskId ||
        args.jobId !== job?.jobId
      ) {
        throw new Error('Fixture completion authority or identity mismatch')
      }
      if (finalization) {
        result = finalization.assess(job)
        break
      }
      if (completionCount++ > 0) {
        throw new Error('Fixture: completion contact lost')
      }
      result = {
        taskId,
        jobId: job.jobId,
        observedAt: timestamp,
        risk: 'low',
        state: 'awaiting_evidence',
        context: { status: 'current', contextDigest },
        issues: [
          {
            code: 'missing_accuracy_manifest',
            message: 'Fixture only — completion evidence has not been verified'
          }
        ],
        gitCommit: 'commit:fixture',
        codeRevision: 'result:fixture',
        workspacePath: job.repositoryPath,
        invariantEvaluations: [],
        verificationRuns: []
      }
      break
    case 'kontext_inspect_runtimes':
      result = { capabilities: [], issues: [], eligibleProviders: [] }
      break
    case 'kontext_inspect_task':
      if (args.taskId !== taskId) {
        throw new Error('Fixture task not registered')
      }
      result = {
        taskId,
        status: 'current',
        codeRevision,
        contextDigest,
        contract: {
          taskId,
          intent: 'Verify the registered logic workflow',
          risk: 'low',
          targets: ['symbol:handler'],
          nonGoals: [],
          acceptance: [
            {
              criterionId: 'criterion:test',
              statement: 'Preserve request identity through recovery',
              verifier: { kind: 'test', ref: 'fixture:test' }
            }
          ]
        },
        requiredEvidenceIds: ['evidence:fixture'],
        normativeRevisionCount: 1,
        conflictCount: 0,
        logic: [
          {
            workItemId: 'logic:handler',
            plannedSymbolIds: ['symbol:handler'],
            allowedPaths: ['src/handler.ts'],
            dependsOn: []
          }
        ]
      }
      break
    case 'kontext_schedule_logic':
      if (!job) {
        job = {
          jobId: 'job:fixture',
          requestId: args.requestId,
          taskId,
          repositoryPath: args.repositoryPath,
          codeRevision,
          contextDigest,
          status: 'queued',
          requestedAt: timestamp,
          resumeCount: 0
        }
        return {
          isError: true,
          content: [
            { type: 'text', text: 'Fixture accepted the request but lost its acknowledgement' }
          ]
        }
      }
      if (args.requestId !== job.requestId) {
        throw new Error('Fixture refuses a duplicate request identity')
      }
      result = job
      break
    case 'kontext_get_schedule':
      if (!job || args.jobId !== job.jobId) {
        throw new Error('Fixture schedule not found')
      }
      refreshCount++
      job = {
        ...job,
        status: refreshCount > 1 ? 'completed' : 'running',
        ...(refreshCount > 1
          ? {
              result: {
                results: [
                  {
                    workItemId: 'logic:handler',
                    status: 'completed',
                    provider: 'codex',
                    attempts: 1,
                    diagnostics: [],
                    changeBundleId: 'bundle:fixture'
                  }
                ]
              }
            }
          : {})
      }
      result = job
      break
    case 'kontext_cancel_schedule':
      if (!job || args.jobId !== job.jobId) {
        throw new Error('Fixture schedule not found')
      }
      job = { ...job, status: 'cancelling' }
      result = job
      break
    case 'kontext_integrate_schedule':
      if (!job || args.jobId !== job.jobId || job.status !== 'completed') {
        throw new Error('Fixture schedule not integratable')
      }
      result = {
        state: {
          taskId,
          scheduleJobId: job.jobId,
          repositoryPath: job.repositoryPath,
          workspacePath: job.repositoryPath,
          baseRevision: codeRevision,
          gitCommit: 'commit:fixture',
          resultRevision: 'result:fixture',
          contextDigest,
          changeBundleIds: ['bundle:fixture'],
          workItemIds: ['logic:handler'],
          changedPaths: ['src/handler.ts'],
          changedSymbolIds: ['symbol:handler'],
          authorProviders: ['codex'],
          createdAt: timestamp
        },
        executions: [
          { status: 'inconclusive', diagnostic: 'Fixture only — no code verification was run' }
        ],
        reused: false
      }
      break
    default:
      throw new Error(`Unexpected fixture tool ${params.name}`)
  }
  return { structuredContent: result, content: [{ type: 'text', text: JSON.stringify(result) }] }
})
await server.connect(new StdioServerTransport())
