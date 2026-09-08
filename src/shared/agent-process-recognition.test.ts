import { describe, expect, it } from 'vitest'
import {
  isAgentForegroundWrapperProcess,
  isExpectedAgentProcess,
  isRecognizedAgentType,
  recognizeAgentProcess,
  recognizeAgentProcessFromCommandLine
} from './agent-process-recognition'

describe('agent process recognition', () => {
  it('recognizes packaged Codex foreground process names', () => {
    expect(recognizeAgentProcess('codex-aarch64-ap')).toEqual({
      agent: 'codex',
      processName: 'codex-aarch64-ap'
    })
    expect(isRecognizedAgentType('codex-aarch64-ap')).toBe(true)
  })

  it('rejects retired the OpenClaude foreground process', () => {
    expect(recognizeAgentProcess('/usr/local/bin/openclaude')).toBeNull()
    expect(isRecognizedAgentType('openclaude')).toBe(false)
    expect(isExpectedAgentProcess('/usr/local/bin/openclaude', 'claude')).toBe(false)
  })

  it('rejects retired the Droid foreground process on Windows', () => {
    expect(recognizeAgentProcess(String.raw`C:\Users\dev\AppData\Roaming\npm\droid.cmd`)).toBeNull()
  })

  it('matches expected agents from platform-specific foreground process paths', () => {
    expect(recognizeAgentProcess('claude')).toEqual({
      agent: 'claude',
      processName: 'claude'
    })
    expect(
      isExpectedAgentProcess(String.raw`C:\Users\dev\AppData\Roaming\npm\claude.exe`, 'claude')
    ).toBe(true)
    expect(isExpectedAgentProcess('/usr/local/bin/claude', 'claude')).toBe(true)
    expect(isExpectedAgentProcess('powershell.exe', 'claude')).toBe(false)
  })

  it('does not recognize Claude print-mode hook subprocesses as interactive agents', () => {
    expect(
      recognizeAgentProcessFromCommandLine(
        'claude --print --model haiku "Analyze this conversation and determine: Does the assistant have more autonomous work to do RIGHT NOW?"'
      )
    ).toBeNull()
    expect(
      recognizeAgentProcessFromCommandLine(
        String.raw`/home/dev/.local/bin/claude -p "Context: This summary will be shown in a list"`
      )
    ).toBeNull()
    expect(
      recognizeAgentProcessFromCommandLine(
        String.raw`C:\Users\dev\AppData\Roaming\npm\claude.exe --output-format=json "hook prompt"`
      )
    ).toBeNull()
    expect(recognizeAgentProcessFromCommandLine('claude --resume abc123')).toEqual({
      agent: 'claude',
      processName: 'claude'
    })
  })

  it('rejects retired Command Code without classifying Windows cmd.exe as an agent', () => {
    expect(recognizeAgentProcess('command-code')).toBeNull()
    expect(
      recognizeAgentProcess(String.raw`C:\Users\dev\AppData\Roaming\npm\command-code.cmd`)
    ).toBeNull()
    expect(isRecognizedAgentType('command-code')).toBe(false)
    expect(isRecognizedAgentType('cmd.exe')).toBe(false)
    expect(recognizeAgentProcess('cmd.exe')).toBeNull()
  })

  it('rejects retired Ante without classifying ante-prefixed path fragments as the agent', () => {
    expect(recognizeAgentProcess('ante')).toBeNull()
    expect(recognizeAgentProcess('/Users/dev/.ante/bin/ante')).toBeNull()
    expect(isRecognizedAgentType('ante')).toBe(false)
    expect(recognizeAgentProcess('ante-obsidian')).toBeNull()
    expect(recognizeAgentProcess('antechamber')).toBeNull()
    expect(isExpectedAgentProcess('ante-obsidian', 'ante')).toBe(false)
  })

  it('does not recognize Ante headless one-shot commands as interactive agents', () => {
    expect(recognizeAgentProcessFromCommandLine('ante -p "summarize this diff"')).toBeNull()
    expect(recognizeAgentProcessFromCommandLine('ante -psummarize')).toBeNull()
    expect(
      recognizeAgentProcessFromCommandLine('ante --prompt "review this for security issues"')
    ).toBeNull()
    expect(
      recognizeAgentProcessFromCommandLine('ante --prompt=review --output-format minimal')
    ).toBeNull()
    expect(recognizeAgentProcessFromCommandLine('ante --resume ses_123')).toBeNull()
  })

  it('does not recognize wrapped Ante headless one-shot commands as interactive agents', () => {
    expect(
      recognizeAgentProcessFromCommandLine('node /Users/dev/.ante/bin/ante --prompt "review"')
    ).toBeNull()
    expect(
      recognizeAgentProcessFromCommandLine(
        String.raw`node C:\Users\dev\.ante\bin\ante.cmd -p review`
      )
    ).toBeNull()
    expect(recognizeAgentProcessFromCommandLine('node /Users/dev/.ante/bin/ante')).toBeNull()
  })

  it('rejects retired Trae by its traecli binary, not the ambiguous trae-cli name', () => {
    expect(recognizeAgentProcess('traecli')).toBeNull()
    expect(recognizeAgentProcess('/Users/dev/.local/bin/traecli')).toBeNull()
    expect(isRecognizedAgentType('traecli')).toBe(false)
    // Why: `trae-cli` and `trae-agent` both name the unrelated open-source bytedance/trae-agent.
    expect(recognizeAgentProcess('trae-cli')).toBeNull()
    expect(recognizeAgentProcess('trae-agent')).toBeNull()
  })

  it('does not recognize Trae headless one-shot commands as interactive agents', () => {
    expect(recognizeAgentProcessFromCommandLine('traecli -p "summarize this diff"')).toBeNull()
    expect(recognizeAgentProcessFromCommandLine('traecli --print "review this"')).toBeNull()
    expect(
      recognizeAgentProcessFromCommandLine('traecli --output-format json "review this"')
    ).toBeNull()
    expect(
      recognizeAgentProcessFromCommandLine('traecli --output-format=stream-json review')
    ).toBeNull()
    expect(recognizeAgentProcessFromCommandLine('traecli --resume AUTO')).toBeNull()
    expect(
      recognizeAgentProcessFromCommandLine('traecli -- "--print the release notes"')
    ).toBeNull()
  })

  it('rejects retired Mistral Vibe by its installed executable and legacy alias', () => {
    expect(recognizeAgentProcess('/home/dev/.local/bin/vibe')).toBeNull()
    expect(recognizeAgentProcess('mistral-vibe')).toBeNull()
    expect(isRecognizedAgentType('vibe')).toBe(false)
  })

  it('rejects retired Qwen Code by its installed qwen executable', () => {
    expect(recognizeAgentProcess('/home/dev/.local/bin/qwen')).toBeNull()
    expect(recognizeAgentProcess(String.raw`C:\Users\dev\AppData\Roaming\npm\qwen.cmd`)).toBeNull()
    expect(isRecognizedAgentType('qwen')).toBe(false)
  })

  it('recognizes supported agents through interpreter wrappers and rejects retired ones', () => {
    expect(
      recognizeAgentProcessFromCommandLine('node /Users/dev/.nvm/versions/node/bin/codex')
    ).toEqual({ agent: 'codex', processName: 'codex' })
    expect(
      recognizeAgentProcessFromCommandLine('node /Users/dev/.nvm/versions/node/bin/gemini')
    ).toBeNull()
    expect(
      recognizeAgentProcessFromCommandLine('python3 /opt/homebrew/bin/hermes --tui')
    ).toBeNull()
    expect(
      recognizeAgentProcessFromCommandLine('python3.12 /opt/homebrew/bin/hermes --tui')
    ).toBeNull()
    expect(recognizeAgentProcessFromCommandLine('python -m aider')).toBeNull()
    expect(
      recognizeAgentProcessFromCommandLine(
        String.raw`python C:\Users\dev\AppData\Roaming\Python\Python312\Scripts\aider.py`
      )
    ).toBeNull()
    expect(
      recognizeAgentProcessFromCommandLine(
        String.raw`node C:\Users\dev\AppData\Roaming\npm\codex.cmd`
      )
    ).toEqual({ agent: 'codex', processName: 'codex' })
    expect(
      recognizeAgentProcessFromCommandLine(
        String.raw`node C:\Users\dev\AppData\Roaming\npm\node_modules\@openai\codex\bin\codex.js`
      )
    ).toEqual({ agent: 'codex', processName: 'codex' })
    expect(
      recognizeAgentProcessFromCommandLine(
        String.raw`node C:\Users\dev\AppData\Roaming\npm\node_modules\@google\gemini-cli\bundle\gemini.mjs`
      )
    ).toBeNull()
  })

  it.each(['ante', 'traecli', 'qwen', 'custom-tool'])(
    'keeps process-name equality separate from agent admission for %s',
    (processName) => {
      expect(isExpectedAgentProcess(`/usr/local/bin/${processName}`, processName)).toBe(true)
      expect(isRecognizedAgentType(processName)).toBe(false)
      expect(recognizeAgentProcess(processName)).toBeNull()
    }
  )

  it('distinguishes wrapped Claude print mode from an interactive prompt containing flags', () => {
    expect(
      recognizeAgentProcessFromCommandLine('node /usr/local/bin/claude --print "review"')
    ).toBeNull()
    for (const command of [
      'node /usr/local/bin/claude --resume abc123',
      'claude -- "--print the release notes"'
    ]) {
      expect(recognizeAgentProcessFromCommandLine(command)).toEqual({
        agent: 'claude',
        processName: 'claude'
      })
    }
  })

  it.each(['earendil-works', 'mariozechner'])(
    'rejects retired the @%s Pi npm entrypoint',
    (scope) => {
      expect(
        recognizeAgentProcessFromCommandLine(
          String.raw`node.exe C:\Users\dev\AppData\Roaming\npm\node_modules\@${scope}\pi-coding-agent\dist\cli.js`
        )
      ).toBeNull()
    }
  )

  it('rejects retired Prime Agent by its binary and npm entrypoint', () => {
    expect(recognizeAgentProcess('prime-agent')).toBeNull()
    expect(recognizeAgentProcess('/opt/homebrew/bin/prime-agent')).toBeNull()
    expect(
      recognizeAgentProcessFromCommandLine(
        'node /opt/homebrew/lib/node_modules/prime-agent/dist/bundle/cli.js'
      )
    ).toBeNull()
    expect(
      recognizeAgentProcessFromCommandLine(
        String.raw`node.exe C:\Users\dev\AppData\Roaming\npm\node_modules\prime-agent\dist\bundle\cli.js`
      )
    ).toBeNull()
  })

  it('does not recognize Prime Agent headless one-shot commands as interactive agents', () => {
    expect(recognizeAgentProcessFromCommandLine('prime-agent -p "summarize this diff"')).toBeNull()
    expect(recognizeAgentProcessFromCommandLine('prime-agent --print "review this"')).toBeNull()
    expect(recognizeAgentProcessFromCommandLine('prime-agent --resume abc123')).toBeNull()
    expect(
      recognizeAgentProcessFromCommandLine('prime-agent -- "--print the release notes"')
    ).toBeNull()
  })

  it('does not recognize Prime Agent non-interactive --mode runs as interactive agents', () => {
    for (const mode of ['json', 'rpc', 'acp', 'daemon']) {
      expect(recognizeAgentProcessFromCommandLine(`prime-agent --mode ${mode}`)).toBeNull()
    }
    expect(recognizeAgentProcessFromCommandLine('prime-agent --mode text')).toBeNull()
    expect(recognizeAgentProcessFromCommandLine('prime-agent --mode=json')).toBeNull()
    expect(recognizeAgentProcessFromCommandLine('prime-agent -- --mode rpc')).toBeNull()
  })

  it('does not classify app CLI commands or retired Teams mode as coding agents', () => {
    expect(recognizeAgentProcessFromCommandLine('orca claude-teams')).toBeNull()
    expect(recognizeAgentProcessFromCommandLine('orca status')).toBeNull()
    expect(recognizeAgentProcessFromCommandLine('orca-dev terminal list')).toBeNull()
    expect(recognizeAgentProcessFromCommandLine('node /usr/local/bin/orca claude-teams')).toBeNull()
    expect(recognizeAgentProcessFromCommandLine('node /usr/local/bin/orca status')).toBeNull()
  })

  it('rejects retired the versioned Cursor Node wrapper without accepting generic agent processes', () => {
    const cursorEntrypoint = String.raw`C:\Users\dev\AppData\Local\cursor-agent\versions\2026.07.09-a3815c0\index.js`

    expect(recognizeAgentProcessFromCommandLine(`node.exe ${cursorEntrypoint}`)).toBeNull()
    expect(
      recognizeAgentProcessFromCommandLine(`node.exe ${cursorEntrypoint} worker-server`)
    ).toBeNull()
    expect(
      recognizeAgentProcessFromCommandLine(String.raw`node.exe C:\repo\cursor-agent\index.js`)
    ).toBeNull()
    expect(
      recognizeAgentProcessFromCommandLine(String.raw`C:\Users\dev\.grok\bin\agent.exe`)
    ).toBeNull()
  })

  it('does not classify prompt text as a wrapped agent command', () => {
    expect(
      recognizeAgentProcessFromCommandLine(
        'node /tmp/not-an-agent.js "compare opencode vs orca in Gemini CLI"'
      )
    ).toBeNull()
    expect(recognizeAgentProcessFromCommandLine(String.raw`node C:\tmp\not-an-agent.js`)).toBeNull()
    expect(
      recognizeAgentProcessFromCommandLine(
        String.raw`node C:\repo\server.js --plugin C:\tmp\codex.js`
      )
    ).toBeNull()
    expect(recognizeAgentProcessFromCommandLine(String.raw`node C:\repo\codex.js`)).toBeNull()
    expect(recognizeAgentProcessFromCommandLine(String.raw`node C:\repo\gemini.mjs`)).toBeNull()
    expect(
      recognizeAgentProcessFromCommandLine(
        String.raw`node C:\repo\node_modules\@example\pi-coding-agent\dist\cli.js`
      )
    ).toBeNull()
    expect(recognizeAgentProcessFromCommandLine(String.raw`python C:\repo\aider.py`)).toBeNull()
    expect(recognizeAgentProcessFromCommandLine('python -m not_aider')).toBeNull()
  })

  it('identifies only foreground processes that can wrap agent entrypoints', () => {
    expect(isAgentForegroundWrapperProcess('node.exe')).toBe(true)
    expect(isAgentForegroundWrapperProcess('/usr/bin/python3')).toBe(true)
    expect(isAgentForegroundWrapperProcess('python3.12.exe')).toBe(true)
    expect(isAgentForegroundWrapperProcess('bash')).toBe(false)
    expect(isAgentForegroundWrapperProcess('vim.exe')).toBe(false)
  })

  it('rejects retired the Antigravity CLI from bare, POSIX and Windows command lines', () => {
    expect(recognizeAgentProcess('agy')).toBeNull()
    expect(recognizeAgentProcess('/Users/dev/.local/bin/agy')).toBeNull()
    expect(recognizeAgentProcess(String.raw`C:\Users\dev\AppData\Local\agy\bin\agy.exe`)).toBeNull()
    expect(
      recognizeAgentProcessFromCommandLine(
        String.raw`"C:\Users\dev\AppData\Local\agy\bin\agy.exe" --dangerously-skip-permissions`
      )
    ).toBeNull()
    expect(recognizeAgentProcessFromCommandLine('agy --dangerously-skip-permissions')).toBeNull()
  })

  it('rejects retired versioned Grok process names observed from the installed CLI', () => {
    expect(recognizeAgentProcess('grok-0.2.51')).toBeNull()
  })
})
