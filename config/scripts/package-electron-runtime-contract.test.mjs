import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { relayArtifactFilenames } from '../../src/shared/relay-artifacts.ts'

const projectDir = resolve(import.meta.dirname, '../..')
const require = createRequire(import.meta.url)
const { createPackagedRuntimeNodeModuleResources } = require('../packaged-runtime-node-modules.cjs')
const readProject = (file) => readFileSync(join(projectDir, file), 'utf8')
const packageJson = JSON.parse(readProject('package.json'))
const pnpmWorkspace = parse(readProject('pnpm-workspace.yaml'))

describe('Electron runtime package contract', () => {
  it('keeps root postinstall as the single Electron binary install owner', () => {
    expect(packageJson.scripts.postinstall).toBe('node config/scripts/rebuild-native-deps.mjs')
    expect(pnpmWorkspace.allowBuilds).not.toHaveProperty('electron')
  })

  it('keeps the native Windows registry addon optional and platform-gated', () => {
    const rebuildScript = readFileSync(
      join(projectDir, 'config/scripts/rebuild-native-deps.mjs'),
      'utf8'
    )
    const ensureScript = readFileSync(
      join(projectDir, 'config/scripts/ensure-native-runtime.mjs'),
      'utf8'
    )
    expect(packageJson.optionalDependencies['windows-native-registry']).toBe('3.2.2')
    // Why: pnpm installs optional target architectures on every host; the root
    // Windows-only rebuild owns this addon so macOS/Linux never run node-gyp for it.
    expect(pnpmWorkspace.allowBuilds['windows-native-registry']).toBe(false)
    // Why assert the guard and the member separately: the list now carries more
    // than one addon, so pinning the whole literal only tested its formatting.
    expect(rebuildScript).toContain("rebuildPlatform === 'win32'")
    expect(rebuildScript).toContain("'windows-native-registry'")
    expect(ensureScript).toContain("process.platform === 'win32'")
    expect(ensureScript).toContain("'windows-native-registry'")
    const packageTargets = {
      win32: createPackagedRuntimeNodeModuleResources('win32'),
      darwin: createPackagedRuntimeNodeModuleResources('darwin'),
      linux: createPackagedRuntimeNodeModuleResources('linux')
    }
    expect(packageTargets.win32).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ to: join('node_modules', 'windows-native-registry') }),
        expect.objectContaining({ to: join('node_modules', 'node-addon-api') })
      ])
    )
    for (const platform of ['darwin', 'linux']) {
      expect(packageTargets[platform]).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ to: join('node_modules', 'windows-native-registry') })
        ])
      )
    }
  })

  it('keeps the native Windows process-table addon optional and platform-gated', () => {
    const rebuildScript = readFileSync(
      join(projectDir, 'config/scripts/rebuild-native-deps.mjs'),
      'utf8'
    )
    const ensureScript = readFileSync(
      join(projectDir, 'config/scripts/ensure-native-runtime.mjs'),
      'utf8'
    )
    expect(packageJson.optionalDependencies['@vscode/windows-process-tree']).toBe('0.8.0')
    // Why: same rule as the registry addon -- pnpm installs optional deps on
    // every host, so macOS/Linux must never run node-gyp for a Windows addon.
    expect(pnpmWorkspace.allowBuilds['@vscode/windows-process-tree']).toBe(false)
    expect(rebuildScript).toContain("'@vscode/windows-process-tree'")
    expect(ensureScript).toContain("'@vscode/windows-process-tree'")
    // Why pin the patch: the upstream binding.gyp requires Spectre-mitigated
    // libraries our build agents do not carry, and the enumeration stops after
    // 1024 processes -- on a busy host that silently hides the very descendants
    // teardown is looking for.
    expect(pnpmWorkspace.patchedDependencies['@vscode/windows-process-tree@0.8.0']).toBe(
      'config/patches/@vscode__windows-process-tree@0.8.0.patch'
    )
    const packageTargets = {
      win32: createPackagedRuntimeNodeModuleResources('win32'),
      darwin: createPackagedRuntimeNodeModuleResources('darwin'),
      linux: createPackagedRuntimeNodeModuleResources('linux')
    }
    expect(packageTargets.win32).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ to: join('node_modules', '@vscode', 'windows-process-tree') })
      ])
    )
    for (const platform of ['darwin', 'linux']) {
      expect(packageTargets[platform]).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ to: join('node_modules', '@vscode', 'windows-process-tree') })
        ])
      )
    }
  })

  it('guards package scripts that launch Electron tooling', () => {
    const scripts = packageJson.scripts
    const guardedScripts = [
      'start',
      'dev',
      'dev-stable-name',
      'build:unpack',
      'build:win',
      'build:mac',
      'build:linux',
      'test:e2e',
      'test:e2e:terminal-rendering-golden',
      'test:e2e:posix-profile-index-golden',
      'test:e2e:headful'
    ]

    for (const scriptName of guardedScripts) {
      expect(scripts[scriptName], scriptName).toContain('pnpm run ensure:electron-runtime &&')
    }
  })

  it('keeps Windows and Linux package builds off macOS native helper builds', () => {
    const scripts = packageJson.scripts

    expect(scripts['build:desktop']).not.toContain('build:computer-macos')
    expect(scripts['build:desktop']).not.toContain('build:keyboard-layout-macos')
    expect(scripts['build:win']).toContain('pnpm run build:desktop')
    expect(scripts['build:win']).not.toContain('pnpm run build ')
    expect(scripts['build:win']).not.toContain('build:computer-macos')
    expect(scripts['build:win']).not.toContain('build:keyboard-layout-macos')
    expect(scripts['build:linux']).toContain('pnpm run build:desktop')
    expect(scripts['build:linux']).not.toContain('pnpm run build ')
    expect(scripts['build:linux']).not.toContain('build:computer-macos')
    expect(scripts['build:linux']).not.toContain('build:keyboard-layout-macos')
    expect(scripts['build:mac']).toContain('pnpm run build:computer-macos')
    expect(scripts['build:mac']).toContain('pnpm run build:keyboard-layout-macos')
    expect(scripts['build:release']).toContain('pnpm run build:native')
    expect(scripts['build:release']).not.toContain('build:computer-macos')
  })

  it('runs the web build through the heap-sized Vite wrapper', () => {
    expect(packageJson.scripts['build:web']).toContain('node config/scripts/run-vite-web-build.mjs')
    expect(packageJson.scripts['build:web']).toContain('node config/scripts/verify-web-build.mjs')
  })

  it('packages the SSH relay watcher child', () => {
    const relayBuild = readFileSync(join(projectDir, 'config/scripts/build-relay.mjs'), 'utf8')
    const builderConfig = readFileSync(
      join(projectDir, 'config/electron-builder.config.cjs'),
      'utf8'
    )
    const remoteCommands = readFileSync(
      join(projectDir, 'src/main/ssh/ssh-remote-commands.ts'),
      'utf8'
    )
    expect(relayBuild).toContain("'parcel-watcher-process-entry.ts'")
    expect(relayBuild).toContain("outfile: join(outDir, 'relay-watcher.js')")
    expect(relayBuild).toContain("outfile: join(outDir, 'relay-ai-vault-service.js')")
    expect(builderConfig).toContain("from: 'out/relay'")

    // Hashing and remote install probing are manifest-driven, so the contract
    // is that both companions are declared once and that both sites read it.
    expect(relayArtifactFilenames(true)).toContain('relay-watcher.js')
    expect(relayArtifactFilenames(true)).toContain('relay-ai-vault-service.js')
    expect(relayBuild).toContain('relayArtifactFilenames(')
    expect(remoteCommands).toContain('relayArtifactFilenames(')
  })

  it('packages and verifies the Windows SSH node-pty console-list fallback', () => {
    const relayBuild = readFileSync(join(projectDir, 'config/scripts/build-relay.mjs'), 'utf8')
    const relayDeploy = readFileSync(join(projectDir, 'src/main/ssh/ssh-relay-deploy.ts'), 'utf8')
    const patchAsset = readFileSync(
      join(projectDir, 'config/relay-assets/node-pty-1.1.0-console-list-agent-patch.cjs'),
      'utf8'
    )

    expect(relayBuild).toContain('copyFileSync(')
    expect(relayBuild).toContain('hash.update(readFileSync')
    expect(relayBuild).toContain('node-pty-1.1.0-console-list-agent-patch.cjs')
    expect(relayDeploy).toContain('assertPatchedNodePtyConsoleListAgent')
    expect(relayDeploy.match(/\$\{windowsNodePtyPatchCommand\(nodePath\)\}/g)).toHaveLength(2)
    expect(patchAsset).toContain('consoleProcessList = [shellPid];')
    expect(patchAsset).toContain('packageJson.version !== EXPECTED_NODE_PTY_VERSION')
  })

  it('keeps Linux postinstall repairing Chromium sandbox permissions', () => {
    const afterInstallScript = readFileSync(
      join(projectDir, 'resources/linux/packaging/after-install.sh'),
      'utf8'
    )

    expect(afterInstallScript).toContain('chrome-sandbox')
    expect(afterInstallScript).toContain('chmod 4755 "$sandbox"')
    expect(afterInstallScript).not.toContain('chmod 0755 "$sandbox"')
    expect(afterInstallScript).toContain('is_owned_link()')
    expect(afterInstallScript).toContain('readlink -f -- "$link"')
    expect(afterInstallScript).toContain('[ ! -e "$link" ] && [ ! -L "$link" ]')
    expect(afterInstallScript).not.toContain('[ ! -e "$link" ] || [ -L "$link" ]')
  })

  it('installs the Electron package binary in the shared unit-test workflow', () => {
    const unitTestWorkflow = parse(
      readFileSync(join(projectDir, '.github/workflows/unit-tests.yml'), 'utf8')
    )
    const installStep = unitTestWorkflow.jobs.test.steps.find(
      (step) => step.name === 'Install Electron package binary for tests'
    )

    expect(installStep.run).toBe('node config/scripts/install-electron-package-binary.mjs')
  })

  it('smokes the packaged CLI from outside the checkout in PR checks', () => {
    const prWorkflow = readFileSync(join(projectDir, '.github/workflows/pr.yml'), 'utf8')
    const parsedWorkflow = parse(prWorkflow)
    const smokeStep = parsedWorkflow.jobs.package.steps.find(
      (step) => step.name === 'Smoke packaged CLI'
    )

    expect(smokeStep.run).toBe(
      'node config/scripts/smoke-packaged-cli.mjs --app-dir=dist/linux-unpacked'
    )
  })

  it('keeps terminal scale perf wired to the report budget gate', () => {
    const packageScripts = packageJson.scripts
    const terminalPerfWorkflow = parse(
      readFileSync(join(projectDir, '.github/workflows/terminal-perf.yml'), 'utf8')
    )
    const steps = terminalPerfWorkflow.jobs['terminal-perf'].steps
    const runStep = steps.find((step) => step.name === 'Run terminal scale perf report gate')
    const uploadStep = steps.find((step) => step.name === 'Upload terminal perf report')

    expect(packageScripts['test:e2e:terminal-perf:scale:report']).toContain(
      'run-terminal-scale-perf-report-gate.mjs'
    )
    expect(runStep.run).toContain('pnpm run test:e2e:terminal-perf:scale:report')
    expect(runStep.run).toContain('xvfb-run --auto-servernum')
    const manualProfileKnobs = [
      ['ORCA_TERMINAL_PERF_FRAME_COUNT', 'frame_count', 'ORCA_E2E_OPENCODE_FRAME_COUNT'],
      [
        'ORCA_TERMINAL_PERF_FRAME_INTERVAL_MS',
        'frame_interval_ms',
        'ORCA_E2E_OPENCODE_FRAME_INTERVAL_MS'
      ],
      [
        'ORCA_TERMINAL_PERF_PRESSURE_OUTPUT_CHARS',
        'pressure_output_chars',
        'ORCA_E2E_OPENCODE_PRESSURE_OUTPUT_CHARS'
      ],
      ['ORCA_TERMINAL_PERF_SCALE_PANES', 'scale_panes', 'ORCA_E2E_OPENCODE_SCALE_PANES'],
      [
        'ORCA_TERMINAL_PERF_SCALE_CROSS_WORKSPACE_PANES',
        'scale_cross_workspace_panes',
        'ORCA_E2E_OPENCODE_SCALE_CROSS_WORKSPACE_PANES'
      ],
      [
        'ORCA_TERMINAL_PERF_SCALE_PRESSURE_PANES',
        'scale_pressure_panes',
        'ORCA_E2E_OPENCODE_SCALE_PRESSURE_PANES'
      ],
      [
        'ORCA_TERMINAL_PERF_SCALE_HIDDEN_PRESSURE_PANES',
        'scale_hidden_pressure_panes',
        'ORCA_E2E_OPENCODE_SCALE_HIDDEN_PRESSURE_PANES'
      ]
    ]
    for (const [workflowEnv, inputName, runnerEnv] of manualProfileKnobs) {
      expect(runStep.env[workflowEnv]).toBe(`\${{ inputs.${inputName} }}`)
      expect(runStep.run).toContain(runnerEnv)
    }
    expect(uploadStep.uses).toBe('actions/upload-artifact@v7')
    expect(uploadStep.with.path).toBe('${{ env.ORCA_E2E_TERMINAL_PERF_REPORT_PATH }}')
  })
})
