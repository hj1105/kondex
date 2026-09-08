import { z } from 'zod'
import {
  kontextPlanRequestSchema,
  kontextPlanRefinementRequestSchema
} from '../../../../shared/kontext-planning-contract'
import {
  kontextOwnerSchema,
  sameKontextOwner,
  type KontextRequestOwner
} from './kontext-request-journal'

const entrySchema = z
  .object({
    owner: kontextOwnerSchema,
    requestId: z.string().uuid(),
    workspace: z.string().min(1),
    createdAt: z.string().datetime(),
    request: kontextPlanRequestSchema.optional(),
    refinementRequest: kontextPlanRefinementRequestSchema.optional()
  })
  .refine(
    (entry) =>
      (!entry.request ||
        (entry.request.requestId === entry.requestId &&
          entry.request.workspace === entry.workspace)) &&
      (!entry.refinementRequest ||
        (!entry.request && entry.refinementRequest.requestId === entry.requestId))
  )
export type KontextPlanEntry = z.infer<typeof entrySchema>
const prefix = 'kondex.kontext.plan.v1.'

export function readKontextPlans(storage: Storage, owner: KontextRequestOwner): KontextPlanEntry[] {
  const entries: KontextPlanEntry[] = []
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index)
    if (!key?.startsWith(prefix)) {
      continue
    }
    const entry = entrySchema.parse(JSON.parse(storage.getItem(key) ?? 'null'))
    if (key !== `${prefix}${entry.requestId}`) {
      throw new Error('Saved plan identity mismatch')
    }
    if (sameKontextOwner(owner, entry.owner)) {
      entries.push(entry)
    }
  }
  return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function saveKontextPlan(storage: Storage, value: KontextPlanEntry): void {
  const entry = entrySchema.parse(value)
  const key = `${prefix}${entry.requestId}`
  const encoded = JSON.stringify(entry)
  const previous = storage.getItem(key)
  if (previous !== null && previous !== encoded) {
    throw new Error('Cannot replace an existing planning request')
  }
  storage.setItem(key, encoded)
  if (storage.getItem(key) !== encoded) {
    throw new Error('Planning request recovery could not be saved')
  }
}
