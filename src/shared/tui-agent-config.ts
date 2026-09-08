import type { TuiAgent } from './tui-agent'

export type AgentPromptInjectionMode = 'argv'
export type DraftPasteReadySignal = 'codex-composer-prompt' | 'render-quiet-after-bracketed-paste'
export type TuiAgentDetectionRuntime = NodeJS.Platform | 'wsl'

export type TuiAgentConfig = {
  detectCmd: string
  detectCmdAliases?: readonly string[]
  detectRequiredCommands?: readonly string[]
  detectUnsupportedRuntimes?: readonly TuiAgentDetectionRuntime[]
  launchCmd: string
  launchCmdByPlatform?: Partial<Record<NodeJS.Platform, string>>
  expectedProcess: string
  promptInjectionMode: AgentPromptInjectionMode
  argvPromptSeparator?: '--'
  draftPromptFlag?: string
  draftPromptEnvVar?: string
  preflightTrust?: 'codex'
  draftPasteReadySignal?: DraftPasteReadySignal
  draftPasteReadyTimeoutMs?: number
  submitRetryDelayMs?: number
  windowsShiftEnterEncoding?: 'csi-u'
  windowsInputRecordPasteNewline?: 'alt-enter' | 'csi-u'
  ctrlEnterEncoding?: 'csi-u'
}

export const TUI_AGENT_CONFIG: Record<TuiAgent, TuiAgentConfig> = {
  claude: {
    detectCmd: 'claude',
    launchCmd: 'claude',
    expectedProcess: 'claude',
    promptInjectionMode: 'argv',
    draftPromptFlag: '--prefill'
  },
  codex: {
    detectCmd: 'codex',
    launchCmd: 'codex',
    expectedProcess: 'codex',
    promptInjectionMode: 'argv',
    windowsInputRecordPasteNewline: 'alt-enter',
    preflightTrust: 'codex',
    draftPasteReadySignal: 'codex-composer-prompt',
    draftPasteReadyTimeoutMs: 20_000,
    submitRetryDelayMs: 1200
  }
}

export function isTuiAgent(value: unknown): value is TuiAgent {
  return typeof value === 'string' && Object.hasOwn(TUI_AGENT_CONFIG, value)
}

export function getTuiAgentDetectCommands(config: TuiAgentConfig): string[] {
  return [config.detectCmd, ...(config.detectCmdAliases ?? [])]
}

export function getTuiAgentLaunchCommand(
  config: TuiAgentConfig,
  platform: NodeJS.Platform,
  opts?: { isRemote?: boolean }
): string {
  void opts
  return config.launchCmdByPlatform?.[platform] ?? config.launchCmd
}
