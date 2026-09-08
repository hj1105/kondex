import { z } from 'zod'
import {
  kontextScheduleJobSchema,
  kontextScheduleLogicSchema
} from '../../../../shared/kontext-schedule-contract'

export const kontextOwnerSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('local') }),
  z.object({
    kind: z.literal('environment'),
    environmentId: z.string().min(1),
    pairingRevision: z.number()
  })
])
const entrySchema = z.object({
  version: z.literal(1),
  owner: kontextOwnerSchema,
  request: kontextScheduleLogicSchema.required({ requestId: true }),
  phase: z.enum(['pending', 'accepted', 'unknown']),
  job: kontextScheduleJobSchema.optional(),
  updatedAt: z.string().datetime()
})
export type KontextRequestOwner = z.infer<typeof kontextOwnerSchema>
export type KontextRequestEntry = z.infer<typeof entrySchema>
const PREFIX = 'kondex.kontext.enqueue.v1.'

export function sameKontextOwner(left: KontextRequestOwner, right: KontextRequestOwner): boolean {
  return (
    left.kind === right.kind &&
    (left.kind === 'local' ||
      (right.kind === 'environment' &&
        left.environmentId === right.environmentId &&
        left.pairingRevision === right.pairingRevision))
  )
}

export function readKontextRequests(
  storage: Storage,
  owner: KontextRequestOwner
): KontextRequestEntry[] {
  const entries: KontextRequestEntry[] = []
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index)
    if (!key?.startsWith(PREFIX)) {
      continue
    }
    const serialized = storage.getItem(key)
    if (serialized === null) {
      continue
    }
    const entry = entrySchema.parse(JSON.parse(serialized))
    if (key !== `${PREFIX}${entry.request.requestId}`) {
      throw new Error('Saved Kontext request identity is invalid.')
    }
    if (sameKontextOwner(entry.owner, owner)) {
      entries.push(entry)
    }
  }
  return entries.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

export function saveKontextRequest(storage: Storage, value: KontextRequestEntry): void {
  const entry = entrySchema.parse(value)
  const key = `${PREFIX}${entry.request.requestId}`
  const previous = storage.getItem(key)
  if (previous) {
    const existing = entrySchema.parse(JSON.parse(previous))
    if (
      !sameKontextOwner(existing.owner, entry.owner) ||
      JSON.stringify(existing.request) !== JSON.stringify(entry.request)
    ) {
      throw new Error('A saved Kontext request cannot change its owner or instructions.')
    }
  }
  const serialized = JSON.stringify(entry)
  storage.setItem(key, serialized)
  if (storage.getItem(key) !== serialized) {
    throw new Error('The Kontext request could not be saved. No new execution was requested.')
  }
}
