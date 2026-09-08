import { z } from 'zod'
import { SkillInstallDestinationSchema } from './skill-install-contract'

export const BUNDLED_SKILL_INSTALL_CAPABILITY = 'skills.install.bundled-kondex.v1' as const
export const BUNDLED_SKILL_INSTALL_UPDATE_REQUIRED_MESSAGE =
  'Update Kondex on the selected machine to install its bundled skills.'

export const BundledSkillInstallRequestSchema = z
  .object({
    operationId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
    skillNames: z
      .array(z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/))
      .min(1)
      .max(5),
    destination: SkillInstallDestinationSchema,
    // An empty selection installs only the canonical universal skill directory.
    providers: z.array(z.enum(['codex', 'claude'])).max(2)
  })
  .strict()
  .refine((value) => new Set(value.providers).size === value.providers.length, {
    message: 'bundled-skill-providers-duplicate'
  })

export type BundledSkillInstallRequest = z.infer<typeof BundledSkillInstallRequestSchema>
