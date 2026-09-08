import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
const repoRoot = path.resolve(fileURLToPath(new URL('../../../../../', import.meta.url)))
const expected = new Map([
  ['settings/ComputerUseSkillSetupPanel.tsx', 'kondex-computer-use'],
  ['settings/CliSection.tsx', 'kondex-cli'],
  ['settings/BrowserUseSkillStep.tsx', 'kondex-cli'],
  ['settings/OrchestrationPane.tsx', 'kondex-orchestration'],
  ['settings/OrchestrationSetupCard.tsx', 'kondex-orchestration'],
  ['floating-terminal/FloatingTerminalOrchestrationDialog.tsx', 'kondex-orchestration'],
  ['settings/MobileEmulatorAgentControlRow.tsx', 'kondex-cli'],
  ['emulator-pane/MobileEmulatorAgentSetupGuideSteps.tsx', 'kondex-cli']
])
const componentRoot = path.join(repoRoot, 'src/renderer/src/components')
function source(file: string) {
  return readFileSync(path.join(componentRoot, file), 'utf8')
}
function callers(directory: string, tag: string): string[] {
  const result: string[] = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      result.push(...callers(file, tag))
    } else if (
      entry.name.endsWith('.tsx') &&
      !entry.name.includes('.test.') &&
      readFileSync(file, 'utf8').includes(tag)
    ) {
      result.push(path.relative(componentRoot, file).split(path.sep).join('/'))
    }
  }
  return result.sort()
}
describe('bundled skill setup callers', () => {
  it('migrates every built-in setup panel and pins its canonical name', () => {
    expect(callers(componentRoot, '<AgentSkillSetupPanel')).toEqual([])
    expect(callers(componentRoot, '<BundledAgentSkillSetupPanel')).toEqual(
      [...expected.keys()].sort()
    )
    for (const [file, name] of expected) {
      expect(source(file), file).toContain(`skillName="${name}"`)
      expect(source(file), file).not.toContain('npx')
      expect(source(file), file).not.toContain('SKILL_INSTALL_COMMAND')
    }
  })
  it('keeps emulator installation on the same local host as its discovery', () => {
    for (const file of [
      'settings/MobileEmulatorAgentControlRow.tsx',
      'emulator-pane/MobileEmulatorAgentSetupGuideSteps.tsx'
    ]) {
      expect(source(file)).toContain("targetOverride={{ kind: 'local' }}")
      expect(source(file)).toContain("runtime: 'host'")
      expect(source(file)).toContain('discoveryState=')
    }
  })
  it('keeps CLI setup discovery and install on the same explicitly selected runtime', () => {
    expect(source('settings/CliSection.tsx')).toContain('discoveryTarget: cliSkillDiscoveryTarget')
    expect(source('settings/CliSection.tsx')).toContain('runtimeOverride={{')
    expect(source('settings/CliSection.tsx')).toContain('agentRuntime,')
    expect(source('settings/CliSection.tsx')).toContain('onBeforeInstall=')
  })
  it('retains orchestration coverage and nested-worker settings without a second install path', () => {
    const pane = source('settings/OrchestrationPane.tsx')
    expect(pane).toContain('<OrchestrationSkillAgentCoverage')
    expect(pane).toContain('nestedWorkerMaxDepth')
    expect(pane).not.toContain('<OrchestrationSkillPromptDialog')
  })
})
