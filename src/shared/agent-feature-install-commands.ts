export const ORCA_CLI_SKILL_NAME = 'kondex-cli'
export const COMPUTER_USE_SKILL_NAME = 'kondex-computer-use'
export const ORCHESTRATION_SKILL_NAME = 'kondex-orchestration'

// Native CLI commands are unattended; GUI provider selection uses the runtime API.
export type AgentFeatureSkillCommandOptions = {
  global?: boolean
  yes?: boolean
  agents?: readonly string[]
}

function skillSelectionArgs(skillNames: readonly string[]): string[] {
  if (skillNames.length === 0) {
    throw new Error('A skill name is required.')
  }
  return skillNames.flatMap((input) => {
    const name = input.trim()
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(name)) {
      throw new Error('A safe skill name is required.')
    }
    return ['--skill', name]
  })
}

export function buildAgentFeatureSkillInstallArgs(
  skillNames: readonly string[],
  options: AgentFeatureSkillCommandOptions = {}
): string[] {
  if (skillNames.length === 0) {
    throw new Error('At least one skill name is required.')
  }
  const global = options.global ?? true
  const agents = options.agents ?? []
  if (options.yes && agents.length === 0) {
    throw new Error('An install target is required when skipping prompts.')
  }
  const unusable = agents.find(
    (agent) => !['codex', 'claude', 'claude-code', 'universal'].includes(agent)
  )
  if (unusable !== undefined) {
    throw new Error(`"${unusable}" is not a usable install target.`)
  }
  const skillArgs = skillSelectionArgs(skillNames)
  return [
    'skills',
    'install',
    ...skillArgs,
    ...(global ? [] : ['--local']),
    ...agents.flatMap((agent) => ['--agent', agent])
  ]
}

export function buildAgentFeatureSkillInstallCommand(
  skillNames: readonly string[],
  options: AgentFeatureSkillCommandOptions = {}
): string {
  return `kondex ${buildAgentFeatureSkillInstallArgs(skillNames, options).join(' ')}`
}

export function buildAgentFeatureSkillUpdateArgs(
  skillNames: string | readonly string[],
  options: AgentFeatureSkillCommandOptions = {}
): string[] {
  const rawNames = typeof skillNames === 'string' ? [skillNames] : skillNames
  if (options.agents?.length) {
    throw new Error('Updates preserve existing installation targets.')
  }
  const global = options.global ?? true
  return ['skills', 'update', ...skillSelectionArgs(rawNames), ...(global ? [] : ['--local'])]
}

export function buildAgentFeatureSkillUpdateCommand(
  skillNames: string | readonly string[],
  options: AgentFeatureSkillCommandOptions = {}
): string {
  return `kondex ${buildAgentFeatureSkillUpdateArgs(skillNames, options).join(' ')}`
}

export const ORCA_CLI_SKILL_INSTALL_COMMAND = buildAgentFeatureSkillInstallCommand([
  ORCA_CLI_SKILL_NAME
])

export const ORCA_CLI_SKILL_UPDATE_COMMAND =
  buildAgentFeatureSkillUpdateCommand(ORCA_CLI_SKILL_NAME)

export const COMPUTER_USE_SKILL_INSTALL_COMMAND = buildAgentFeatureSkillInstallCommand([
  COMPUTER_USE_SKILL_NAME
])

export const COMPUTER_USE_SKILL_UPDATE_COMMAND =
  buildAgentFeatureSkillUpdateCommand(COMPUTER_USE_SKILL_NAME)

export const ORCHESTRATION_SKILL_INSTALL_COMMAND = buildAgentFeatureSkillInstallCommand([
  ORCHESTRATION_SKILL_NAME
])

export const ORCHESTRATION_SKILL_UPDATE_COMMAND =
  buildAgentFeatureSkillUpdateCommand(ORCHESTRATION_SKILL_NAME)

export const ORCA_CLI_ORCHESTRATION_SKILL_INSTALL_COMMAND = buildAgentFeatureSkillInstallCommand([
  ORCA_CLI_SKILL_NAME,
  ORCHESTRATION_SKILL_NAME
])
