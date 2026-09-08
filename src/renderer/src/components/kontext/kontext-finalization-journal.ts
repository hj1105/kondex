import { z } from 'zod'
import { kontextFinalizationRequestSchema } from '../../../../shared/kontext-finalization-contract'
import {
  kontextOwnerSchema,
  sameKontextOwner,
  type KontextRequestOwner
} from './kontext-request-journal'

const entrySchema = z.object({
  owner: kontextOwnerSchema,
  request: kontextFinalizationRequestSchema,
  createdAt: z.string().datetime()
})
export type KontextFinalizationEntry = z.infer<typeof entrySchema>
const prefix = 'kondex.kontext.finalization.v1.'

export function readKontextFinalizations(
  storage: Storage,
  owner: KontextRequestOwner
): KontextFinalizationEntry[] {
  const entries: KontextFinalizationEntry[] = []
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index)
    if (!key?.startsWith(prefix)) {
      continue
    }
    const entry = entrySchema.parse(JSON.parse(storage.getItem(key) ?? 'null'))
    if (key !== `${prefix}${entry.request.requestId}`) {
      throw new Error('Saved finalization identity mismatch')
    }
    if (sameKontextOwner(owner, entry.owner)) {
      entries.push(entry)
    }
  }
  return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function saveKontextFinalization(storage: Storage, value: KontextFinalizationEntry): void {
  const entry = entrySchema.parse(value)
  const key = `${prefix}${entry.request.requestId}`
  const encoded = JSON.stringify(entry)
  const previous = storage.getItem(key)
  if (previous !== null && previous !== encoded) {
    throw new Error('Cannot replace a saved finalization request')
  }
  storage.setItem(key, encoded)
  if (storage.getItem(key) !== encoded) {
    throw new Error('Finalization recovery could not be saved')
  }
}
