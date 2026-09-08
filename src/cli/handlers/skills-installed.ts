import type { SkillDiscoveryResult } from '../../shared/skills'
import type { CommandHandler, HandlerContext } from '../dispatch'
import { printResult } from '../format'
import { RuntimeClientError } from '../runtime-client'

type InstalledSkillSummary = Pick<
  SkillDiscoveryResult['skills'][number],
  'id' | 'name' | 'description' | 'providers' | 'sourceKind' | 'sourceLabel'
>

function rejectForwardedSkillFilesystem(ctx: HandlerContext): void {
  if (!process.env.ORCA_CLI_CWD && !ctx.client.isRemote) {
    return
  }
  throw new RuntimeClientError(
    'invalid_environment',
    'kondex skills installed must run on the machine whose installed skills you want to use. Run the command from a Kondex terminal on that machine.'
  )
}

function installedSummary(result: SkillDiscoveryResult): InstalledSkillSummary[] {
  return result.skills.map(({ id, name, description, providers, sourceKind, sourceLabel }) => ({
    id,
    name,
    description,
    providers,
    sourceKind,
    sourceLabel
  }))
}

function formatInstalledSkills(skills: InstalledSkillSummary[]): string {
  if (skills.length === 0) {
    return 'No installed skills found.'
  }
  return skills
    .map(
      (skill) =>
        `${skill.name} (${skill.id})\n  ${skill.description ?? 'No description'}\n  ${skill.sourceLabel}`
    )
    .join('\n')
}

export const SKILLS_INSTALLED_HANDLERS: Record<string, CommandHandler> = {
  'skills installed': async (ctx) => {
    rejectForwardedSkillFilesystem(ctx)
    const response = await ctx.client.call<SkillDiscoveryResult>('skills.discover', {
      cwd: ctx.cwd
    })
    const skills = installedSummary(response.result)
    printResult({ ...response, result: { skills } }, ctx.json, (value) =>
      formatInstalledSkills(value.skills)
    )
  }
}
