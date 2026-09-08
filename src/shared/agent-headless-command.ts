import { isPrintModeHeadlessOneShotCommand } from './print-mode-headless-command'
import type { TuiAgent } from './tui-agent'

const HEADLESS_ONE_SHOT_MATCHERS: Partial<
  Record<TuiAgent, (tokens: readonly string[]) => boolean>
> = {
  claude: isPrintModeHeadlessOneShotCommand
}

export function isHeadlessOneShotAgentCommand(agent: TuiAgent, tokens: readonly string[]): boolean {
  return HEADLESS_ONE_SHOT_MATCHERS[agent]?.(tokens) ?? false
}

type AgentCommandRecognition = { agent: TuiAgent } | null

export function filterHeadlessOneShotAgentCommand<T extends AgentCommandRecognition>(
  recognition: T,
  tokens: readonly string[]
): T | null {
  if (recognition && isHeadlessOneShotAgentCommand(recognition.agent, tokens)) {
    return null
  }
  return recognition
}
