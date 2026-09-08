import { z } from 'zod'

export const kontextRuntimeProviderSchema = z.enum(['codex', 'claude'])

export const kontextRuntimeCapabilitySchema = z
  .object({
    snapshotId: z.string().min(1),
    provider: kontextRuntimeProviderSchema,
    cliPath: z.string(),
    cliVersion: z.string().min(1).optional(),
    installed: z.boolean(),
    authenticated: z.boolean(),
    billingPath: z.enum(['subscription', 'api', 'unknown']),
    model: z.string().min(1).optional(),
    supports: z
      .object({
        structuredOutput: z.boolean(),
        sessionResume: z.boolean(),
        mcp: z.boolean(),
        hooks: z.boolean(),
        workspaceSandbox: z.boolean()
      })
      .strict(),
    inspectedAt: z.string().datetime({ offset: true }),
    diagnostic: z.string().min(1).optional()
  })
  .strict()

export const kontextRuntimeDoctorIssueSchema = z
  .object({
    provider: kontextRuntimeProviderSchema,
    code: z.enum([
      'not_installed',
      'not_authenticated',
      'api_billing_requires_consent',
      'unknown_billing_path',
      'missing_structured_output',
      'missing_workspace_sandbox'
    ]),
    message: z.string().min(1)
  })
  .strict()

export const kontextRuntimeDoctorReportSchema = z
  .object({
    capabilities: z.array(kontextRuntimeCapabilitySchema),
    issues: z.array(kontextRuntimeDoctorIssueSchema),
    eligibleProviders: z.array(kontextRuntimeProviderSchema)
  })
  .strict()

const kontextRuntimeInspectionFailureSchema = z.object({
  diagnostic: z.string().min(1)
})

export const kontextRuntimeInspectionSchema = z.discriminatedUnion('status', [
  z
    .object({
      status: z.literal('ready'),
      report: kontextRuntimeDoctorReportSchema
    })
    .strict(),
  kontextRuntimeInspectionFailureSchema.extend({ status: z.literal('not_configured') }).strict(),
  kontextRuntimeInspectionFailureSchema.extend({ status: z.literal('unavailable') }).strict()
])

export type KontextRuntimeProvider = z.infer<typeof kontextRuntimeProviderSchema>
export type KontextRuntimeCapability = z.infer<typeof kontextRuntimeCapabilitySchema>
export type KontextRuntimeDoctorReport = z.infer<typeof kontextRuntimeDoctorReportSchema>
export type KontextRuntimeInspection = z.infer<typeof kontextRuntimeInspectionSchema>
