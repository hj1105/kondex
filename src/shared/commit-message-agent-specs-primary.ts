import type { TuiAgent } from './tui-agent'
import type {
  CommitMessageAgentSpec,
  CommitMessageModel,
  ThinkingLevel
} from './commit-message-agent-spec'
import { CLAUDE_MODEL_LIST_ARGS, CLAUDE_MODEL_LIST_STDIN } from './claude-model-list-probe'

type PrimaryAgentSpecDeps = {
  CLAUDE_THINKING_LEVELS: ThinkingLevel[]
  OPENAI_THINKING_LEVELS: ThinkingLevel[]
  parseClaudeModels: (stdout: string) => CommitMessageModel[]
  parseCodexModels: (stdout: string) => CommitMessageModel[]
}

export function buildPrimaryCommitMessageAgentSpecs({
  CLAUDE_THINKING_LEVELS,
  OPENAI_THINKING_LEVELS,
  parseClaudeModels,
  parseCodexModels
}: PrimaryAgentSpecDeps): Partial<Record<TuiAgent, CommitMessageAgentSpec>> {
  return {
    claude: {
      id: 'claude',
      label: 'Claude',
      binary: 'claude',
      // Why: diffs can be large and `claude -p` reads from stdin natively when no
      // positional prompt is provided.
      promptDelivery: 'stdin',
      buildArgs: ({ model, thinkingLevel }) => [
        '-p',
        '--output-format',
        'text',
        '--model',
        model,
        '--permission-mode',
        'plan',
        ...(thinkingLevel ? ['--effort', thinkingLevel] : [])
      ],
      modelSource: 'dynamic',
      // Why: the Claude CLI has no listing subcommand; one list_models control
      // request over --print stream-json returns the /model picker catalog.
      // Older CLIs answer with a control error and exit 0, keeping the fallback.
      modelDiscovery: {
        binary: 'claude',
        args: [...CLAUDE_MODEL_LIST_ARGS],
        stdinPayload: CLAUDE_MODEL_LIST_STDIN,
        parse: parseClaudeModels
      },
      models: [
        {
          // Why: Claude Code aliases track the account/provider's supported
          // model IDs; hardcoded version IDs can be rejected by Bedrock/Vertex.
          id: 'haiku',
          label: 'Haiku'
        },
        {
          id: 'sonnet',
          label: 'Sonnet',
          thinkingLevels: CLAUDE_THINKING_LEVELS,
          defaultThinkingLevel: 'low'
        },
        {
          id: 'opus',
          label: 'Opus',
          thinkingLevels: CLAUDE_THINKING_LEVELS,
          defaultThinkingLevel: 'low'
        }
      ],
      defaultModelId: 'sonnet'
    },
    codex: {
      id: 'codex',
      label: 'Codex',
      binary: 'codex',
      // Why: `codex exec` reads stdin when no prompt arg is supplied. Commit
      // prompts include large staged diffs, so argv would exceed Windows and
      // some SSH/POSIX command-line limits.
      promptDelivery: 'stdin',
      buildArgs: ({ model, thinkingLevel }) => [
        'exec',
        // Why: commit-message generation needs text only, not a persisted agent
        // session or workspace writes. Match the safe git-text mode used by
        // local-first coding agents.
        '--ephemeral',
        '--skip-git-repo-check',
        '-s',
        'read-only',
        '--model',
        model,
        ...(thinkingLevel ? ['-c', `model_reasoning_effort=${thinkingLevel}`] : [])
      ],
      // `-c` is intentionally absent: Codex accepts repeated overrides.
      singletonOptions: [['--model', '-m']],
      modelSource: 'dynamic',
      modelDiscovery: {
        binary: 'codex',
        args: ['debug', 'models'],
        parse: parseCodexModels
      },
      // Why: ordered to match the official `codex` model picker — descending
      // by version so the frontier model lands on top and legacy models trail.
      models: [
        {
          id: 'gpt-5.5',
          label: 'GPT-5.5',
          thinkingLevels: OPENAI_THINKING_LEVELS,
          defaultThinkingLevel: 'low'
        },
        {
          id: 'gpt-5.4',
          label: 'GPT-5.4',
          thinkingLevels: OPENAI_THINKING_LEVELS,
          defaultThinkingLevel: 'low'
        },
        {
          id: 'gpt-5.4-mini',
          label: 'GPT-5.4 Mini',
          thinkingLevels: OPENAI_THINKING_LEVELS,
          defaultThinkingLevel: 'low'
        },
        {
          id: 'gpt-5.3-codex',
          label: 'GPT-5.3 Codex',
          thinkingLevels: OPENAI_THINKING_LEVELS,
          defaultThinkingLevel: 'low'
        },
        {
          // Why: Codex's Spark variant accepts `model_reasoning_effort` (the
          // CLI banner reports "reasoning effort: medium" by default); the
          // gating that surfaces "model not supported" is on the account
          // tier, not the effort flag.
          id: 'gpt-5.3-codex-spark',
          label: 'GPT-5.3 Codex Spark',
          thinkingLevels: OPENAI_THINKING_LEVELS,
          defaultThinkingLevel: 'low'
        },
        {
          id: 'gpt-5.2',
          label: 'GPT-5.2',
          thinkingLevels: OPENAI_THINKING_LEVELS,
          defaultThinkingLevel: 'low'
        }
      ],
      defaultModelId: 'gpt-5.5'
    }
  }
}
