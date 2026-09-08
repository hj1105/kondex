import { isAbsolute, join, resolve } from 'node:path'
import type { SkillProviderRootOverrides } from './skill-provider-destinations'

const PROVIDER_ROOT_MAX_LENGTH = 32_768

function normalizedRoot(value: string | undefined): string | null {
  const candidate = value?.trim()
  if (
    !candidate ||
    candidate.length > PROVIDER_ROOT_MAX_LENGTH ||
    candidate.includes('\0') ||
    !isAbsolute(candidate)
  ) {
    return null
  }
  return resolve(candidate)
}

export function resolveEnvironmentSkillProviderRoots(
  env: NodeJS.ProcessEnv = process.env
): SkillProviderRootOverrides {
  const claudeConfig = normalizedRoot(env.CLAUDE_CONFIG_DIR)
  return claudeConfig ? { claude: join(claudeConfig, 'skills') } : {}
}

export function withClaudeSkillProviderRoot(
  roots: SkillProviderRootOverrides,
  claudeConfigDirectory: string | null | undefined
): SkillProviderRootOverrides {
  const configDirectory = normalizedRoot(claudeConfigDirectory ?? undefined)
  return configDirectory ? { ...roots, claude: join(configDirectory, 'skills') } : roots
}
